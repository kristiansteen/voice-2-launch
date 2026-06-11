import prisma from '../config/database';
import { Board } from '@prisma/client';
import { sendInviteEmail } from './email.service';
import config from '../config';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';

export async function checkBoardPermission(
    boardId: string,
    userId: string,
    requiredPermission: 'view' | 'edit' | 'admin'
): Promise<boolean> {
    const board = await prisma.board.findUnique({
        where: { id: boardId },
        include: {
            collaborators: {
                where: { userId, acceptedAt: { not: null } },
            },
        },
    });

    if (!board) return false;
    if (board.userId === userId) return true;
    if (board.isPublic && requiredPermission === 'view') return true;

    const collaborator = board.collaborators[0];
    if (!collaborator) return false;

    const levels = { view: 1, edit: 2, admin: 3 };
    return levels[collaborator.permission as keyof typeof levels] >= levels[requiredPermission];
}

async function generateUniqueSlug(title: string): Promise<string> {
    const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.board.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter++}`;
    }
    return slug;
}

class BoardService {
    async createBoard(userId: string, title: string, description?: string): Promise<Board> {
        const subscriptionService = (await import('./subscription.service')).default;
        const { allowed, reason } = await subscriptionService.canCreateBoard(userId);

        if (!allowed) {
            logger.warn(`Board creation denied for user ${userId}: ${reason}`);
            throw new Error(reason || 'Cannot create board');
        }

        const slug = await generateUniqueSlug(title);
        const board = await prisma.board.create({
            data: { userId, title, slug, description, gridData: {}, settings: {} },
        });

        logger.info(`Board created: ${board.id} by user ${userId}`);
        return board;
    }

    async getUserBoards(userId: string): Promise<Board[]> {
        return prisma.board.findMany({
            where: {
                OR: [
                    { userId },
                    { collaborators: { some: { userId, acceptedAt: { not: null } } } },
                ],
            },
            orderBy: { updatedAt: 'desc' },
            include: { _count: { select: { sections: true, postits: true, collaborators: true } } },
        });
    }

    async getBoardById(boardId: string, userId: string): Promise<Board | null> {
        const board = await prisma.board.findFirst({
            where: {
                id: boardId,
                OR: [
                    { userId },
                    { collaborators: { some: { userId, acceptedAt: { not: null } } } },
                ],
            },
            include: { sections: { include: { postits: true } }, teamMembers: true },
        });

        if (board) {
            await prisma.board.update({ where: { id: boardId }, data: { lastAccessedAt: new Date() } });
        }

        return board;
    }

    async getBoardBySlug(slug: string, userId?: string): Promise<Board | null> {
        return prisma.board.findFirst({
            where: {
                slug,
                OR: userId
                    ? [
                        { userId },
                        { isPublic: true },
                        { collaborators: { some: { userId, acceptedAt: { not: null } } } },
                    ]
                    : [{ isPublic: true }],
            },
            include: { sections: { include: { postits: true } }, teamMembers: true },
        });
    }

    async updateBoard(boardId: string, userId: string, data: Partial<Board> & { expectedVersion?: number }): Promise<Board> {
        const hasPermission = await checkBoardPermission(boardId, userId, 'edit');
        if (!hasPermission) throw new Error('Unauthorized to update this board');

        const currentBoard = await prisma.board.findUnique({ where: { id: boardId }, select: { version: true } });
        if (!currentBoard) throw new Error('Board not found');

        const { expectedVersion, id, userId: uid, createdAt, updatedAt, ...safeData } = data as any;

        if (expectedVersion !== undefined && currentBoard.version !== expectedVersion) {
            const error = new Error('Board has been modified by another user. Please refresh and try again.');
            (error as any).statusCode = 409;
            (error as any).currentVersion = currentBoard.version;
            throw error;
        }

        // Use updateMany with version in the WHERE clause for optimistic locking
        // (avoids interactive transactions which fail with PgBouncer in transaction mode)
        const whereClause = expectedVersion !== undefined
            ? { id: boardId, version: expectedVersion }
            : { id: boardId };

        const updated = await prisma.board.updateMany({
            where: whereClause,
            data: { ...safeData, version: { increment: 1 }, updatedAt: new Date() },
        });

        if (updated.count === 0) {
            const error = new Error('Board has been modified by another user. Please refresh and try again.');
            (error as any).statusCode = 409;
            throw error;
        }

        const board = await prisma.board.findUnique({ where: { id: boardId } });
        if (!board) throw new Error('Board not found after update');

        logger.info(`Board updated: ${boardId} by user ${userId} (version: ${board.version})`);
        return board;
    }

    async deleteBoard(boardId: string, userId: string): Promise<void> {
        const board = await prisma.board.findFirst({ where: { id: boardId, userId } });
        if (!board) throw new Error('Board not found or unauthorized');
        await prisma.board.delete({ where: { id: boardId } });
        logger.info(`Board deleted: ${boardId} by user ${userId}`);
    }

    async importProjectPlan(
        userId: string,
        plan: {
            plan_name: string;
            process_name?: string;
            duration_weeks: number;
            overview?: string;
            scope?: string;
            tracks: Array<{ id: string; name: string }>;
            tasks: Array<{
                id: string;
                title: string;
                track_id: string;
                week_start: number;
                week_end: number;
                owner?: string;
                improvement_id?: string;
            }>;
            risks?: Array<{
                id: string;
                title: string;
                description?: string;
                probability: number;
                consequence: number;
                mitigation?: string;
                task_id?: string;
            }>;
            improvements?: Array<{
                id: string;
                title: string;
                description?: string;
                benefit?: string;
                effort_score: number;
                impact_score: number;
                category?: string;
            }>;
            invitees?: string[];
        }
    ): Promise<{ boardId: string; boardUrl: string; sectionId: string; tasksCreated: number }> {
        const subscriptionService = (await import('./subscription.service')).default;
        const { allowed, reason } = await subscriptionService.canCreateBoard(userId);
        if (!allowed) throw new Error(reason || 'Cannot create board');

        const title = plan.plan_name || plan.process_name || 'Project Plan';
        const slug = await generateUniqueSlug(title);
        const trackIndex: Record<string, number> = {};
        (plan.tracks || []).forEach((t, i) => { trackIndex[t.id] = i; });
        const today = new Date().toISOString().split('T')[0];
        const risks = plan.risks || [];
        const improvements = plan.improvements || [];
        const trackNames = (plan.tracks || []).map(t => t.name);

        const teamMembers = (plan.invitees || []).map(email => ({
            id: `member_${Math.random().toString(36).slice(2, 9)}`,
            name: email.split('@')[0],
            email,
        }));

        // Stable short IDs for gridstack items (gs-id)
        const weekplanGsId = `weekplan_${Math.random().toString(36).slice(2, 9)}`;
        const matrixGsId = `matrix_${Math.random().toString(36).slice(2, 9)}`;
        const ideasGsId = `ideas_${Math.random().toString(36).slice(2, 9)}`;
        const overviewGsId = `overview_${Math.random().toString(36).slice(2, 9)}`;
        const scopeGsId = `scope_${Math.random().toString(36).slice(2, 9)}`;
        const teamGsId = `team_${Math.random().toString(36).slice(2, 9)}`;

        // ── Build gridData ────────────────────────────────────────────────────
        const e = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const buildTextSection = (sectionTitle: string, body: string) => `
            <div class="section-header">
                <input type="text" class="section-title" value="${e(sectionTitle)}" />
                <div class="section-controls">
                    <button class="section-btn lock-btn" title="Lock Section"><i class="fas fa-unlock"></i></button>
                    <button class="section-btn delete-section-btn" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="section-content postit-dropzone">
                <textarea class="text-content">${e(body)}</textarea>
            </div>`;

        const buildTeamSection = () => `
    <div class="section-header">
        <input type="text" class="section-title" value="Team" />
        <div class="section-controls">
            <button class="section-btn lock-btn" title="Lock Section"><i class="fas fa-unlock"></i></button>
            <button class="section-btn delete-section-btn" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
    </div>
    <div class="section-content">
        <table class="team-table">
            <thead><tr><th>Name</th><th>Email</th><th></th></tr></thead>
            <tbody class="team-members-body">
                <tr class="add-team-row">
                    <td colspan="3"><i class="fas fa-plus"></i> Add Team Member</td>
                </tr>
            </tbody>
        </table>
    </div>`;

        // Weekplan section HTML
        const tracksHtml = trackNames.map(t =>
            `<div class="track-item"><input type="text" value="${e(t)}" /></div>`
        ).join('');
        const weeksHtml = Array.from({ length: plan.duration_weeks }, (_, i) => {
            const cells = trackNames.map(() => `<div class="week-cell postit-dropzone"></div>`).join('');
            return `<div class="week-column" data-week-index="${i}"><div class="week-header">Week ${i + 1}</div>${cells}</div>`;
        }).join('');
        const weekplanHtml = `
            <div class="section-header">
                <input type="text" class="section-title" value="${e(title)}" />
                <div class="section-controls">
                    <button class="section-btn toggle-view-btn" title="Switch to Kanban"><i class="fas fa-exchange-alt"></i></button>
                    <button class="section-btn add-week-btn" title="Add Week"><i class="fas fa-plus"></i></button>
                    <button class="section-btn add-track-btn" title="Add Track"><i class="fas fa-layer-group"></i></button>
                    <button class="section-btn calendar-btn" title="Calendar Settings"><i class="fas fa-calendar-alt"></i></button>
                    <button class="section-btn lock-btn" title="Lock Section"><i class="fas fa-unlock"></i></button>
                    <button class="section-btn delete-section-btn" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="section-content" style="padding: 0; display: flex; flex-direction: column;">
                <div class="week-planner-wrapper">
                    <div class="week-planner-settings">
                        <label>Start Date:</label>
                        <input type="date" class="week-start-date" value="${today}" />
                    </div>
                    <div class="week-planner">
                        <div class="track-column">
                            <div class="track-header">Track</div>
                            ${tracksHtml}
                        </div>
                        <div class="weeks-container">${weeksHtml}</div>
                    </div>
                </div>
            </div>`;

        // Matrix section HTML (only added if risks exist)
        const matrixHtml = `
            <div class="section-header">
                <input type="text" class="section-title" value="Risk Matrix" />
                <div class="section-controls">
                    <button class="section-btn lock-btn" title="Lock Section"><i class="fas fa-unlock"></i></button>
                    <button class="section-btn delete-section-btn" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="section-content matrix-section" data-matrix-id="${matrixGsId}" data-x-label="Probability" data-y-label="Consequence">
                <div class="matrix-container">
                    <div class="matrix-y-label">
                        <input type="text" value="Consequence →" class="y-axis-label" />
                    </div>
                    <div class="matrix-grid postit-dropzone matrix-dropzone" data-matrix-id="${matrixGsId}">
                        <div class="matrix-quadrant postit-dropzone"></div>
                        <div class="matrix-quadrant postit-dropzone"></div>
                        <div class="matrix-quadrant postit-dropzone"></div>
                        <div class="matrix-quadrant postit-dropzone"></div>
                    </div>
                    <div class="matrix-x-label">
                        <input type="text" value="Probability →" class="x-axis-label" />
                    </div>
                </div>
            </div>`;

        // Ideas matrix HTML (only added if improvements exist)
        const ideasMatrixHtml = `
            <div class="section-header">
                <input type="text" class="section-title" value="Ideas Matrix" />
                <div class="section-controls">
                    <button class="section-btn lock-btn" title="Lock Section"><i class="fas fa-unlock"></i></button>
                    <button class="section-btn delete-section-btn" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="section-content matrix-section" data-matrix-id="${ideasGsId}" data-x-label="Effort" data-y-label="Impact">
                <div class="matrix-container">
                    <div class="matrix-y-label">
                        <input type="text" value="Impact →" class="y-axis-label" />
                    </div>
                    <div class="matrix-grid postit-dropzone matrix-dropzone" data-matrix-id="${ideasGsId}">
                        <div class="matrix-quadrant postit-dropzone"></div>
                        <div class="matrix-quadrant postit-dropzone"></div>
                        <div class="matrix-quadrant postit-dropzone"></div>
                        <div class="matrix-quadrant postit-dropzone"></div>
                    </div>
                    <div class="matrix-x-label">
                        <input type="text" value="Effort →" class="x-axis-label" />
                    </div>
                </div>
            </div>`;

        // Grid layout — left column always present (x=0, w=2), weekplan always at x=2
        const gridItems: object[] = [
            { x: 0, y: 0, w: 2, h: 3, id: overviewGsId, content: buildTextSection('Overview', plan.overview || '') },
            { x: 0, y: 3, w: 2, h: 2, id: scopeGsId, content: buildTextSection('Scope', plan.scope || '') },
            { x: 0, y: 5, w: 2, h: 3, id: teamGsId, content: buildTeamSection() },
            { x: 2, y: 0, w: 8, h: 5, id: weekplanGsId, content: weekplanHtml },
        ];

        let matrixX = 2;
        if (risks.length > 0) {
            gridItems.push({ x: 2, y: 5, w: 4, h: 4, id: matrixGsId, content: matrixHtml });
            matrixX = 6;
        }
        if (improvements.length > 0) {
            gridItems.push({ x: matrixX, y: 5, w: 4, h: 4, id: ideasGsId, content: ideasMatrixHtml });
        }

        // Postit state for all tasks
        const postitState: Record<string, object> = {};
        for (const task of (plan.tasks || [])) {
            const pid = `postit_${Math.random().toString(36).slice(2, 9)}`;
            postitState[pid] = {
                id: pid,
                color: 'green',
                x: 10, y: 10,
                content: `${task.title}\nWk ${task.week_start}–${task.week_end}`,
                owner: task.owner || '',
                status: 'todo',
                section: weekplanGsId,
                isMatrix: false,
                isWeekPlan: true,
                weekIndex: (task.week_start ?? 1) - 1,
                trackIndex: trackIndex[task.track_id] ?? 0,
                xValue: 50, yValue: 50,
                mitigation: '',
                rotation: 0,
            };
        }

        // Postit state for risks (colour by severity)
        for (const risk of risks) {
            const score = (risk.probability ?? 50) * (risk.consequence ?? 50);
            const riskColour = score >= 5000 ? 'pink' : score >= 2000 ? 'orange' : 'yellow';
            const pid = `postit_${Math.random().toString(36).slice(2, 9)}`;
            postitState[pid] = {
                id: pid,
                color: riskColour,
                x: 0, y: 0,
                content: `${risk.title}${risk.description ? '\n' + risk.description : ''}`,
                owner: '',
                status: 'todo',
                section: matrixGsId,
                isMatrix: true,
                isWeekPlan: false,
                xValue: risk.probability ?? 50,
                yValue: risk.consequence ?? 50,
                mitigation: risk.mitigation || '',
                rotation: 0,
            };
        }

        // Postit state for ideas (colour by category)
        const IDEA_COLOURS = ['blue', 'green', 'yellow', 'orange', 'pink'] as const;
        for (const [i, idea] of improvements.entries()) {
            const pid = `postit_${Math.random().toString(36).slice(2, 9)}`;
            postitState[pid] = {
                id: pid,
                color: IDEA_COLOURS[i % IDEA_COLOURS.length],
                x: 0, y: 0,
                content: `${idea.title}${idea.description ? '\n' + idea.description : ''}`,
                owner: '',
                status: 'todo',
                section: ideasGsId,
                isMatrix: true,
                isWeekPlan: false,
                xValue: idea.effort_score ?? 50,
                yValue: idea.impact_score ?? 50,
                mitigation: idea.benefit || '',
                rotation: 0,
            };
        }

        const sectionContent: Record<string, object> = {
            [weekplanGsId]: {
                title,
                custom: { type: 'weekplan', tracks: trackNames, weeks: plan.duration_weeks, startDate: today },
            },
        };
        if (risks.length > 0) {
            sectionContent[matrixGsId] = {
                title: 'Risk Matrix',
                xLabel: 'Probability',
                yLabel: 'Consequence',
                custom: { type: 'matrix' },
            };
        }
        if (improvements.length > 0) {
            sectionContent[ideasGsId] = {
                title: 'Ideas Matrix',
                xLabel: 'Effort',
                yLabel: 'Impact',
                custom: { type: 'matrix' },
            };
        }
        sectionContent[teamGsId] = { title: 'Team' };

        const gridData = {
            grid: gridItems,
            postits: postitState,
            sectionContent,
            eventLog: [],
            matrixLog: [],
            lockedSections: [],
            projectTitle: title,
            teamMembers,
            version: 2,
        };

        // ── Persist (sequential queries — compatible with PgBouncer transaction mode) ──
        const board = await prisma.board.create({
            data: { userId, title, slug, gridData: gridData as any, settings: {} },
        });

        const section = await prisma.section.create({
            data: {
                boardId: board.id,
                type: 'weekplan',
                content: { tracks: plan.tracks, weeks: plan.duration_weeks, startDate: today } as any,
            },
        });

        // Task post-its
        let tasksCreated = 0;
        for (const task of (plan.tasks || [])) {
            await prisma.postit.create({
                data: {
                    boardId: board.id,
                    sectionId: section.id,
                    color: 'green',
                    content: `${task.title}\nWk ${task.week_start}–${task.week_end}`,
                    owner: task.owner || null,
                    status: 'todo',
                },
            });
            tasksCreated++;
        }

        // Risk matrix section + post-its
        if (risks.length > 0) {
            const riskSection = await prisma.section.create({
                data: { boardId: board.id, type: 'matrix', content: {} as any },
            });
            for (const risk of risks) {
                await prisma.postit.create({
                    data: {
                        boardId: board.id,
                        sectionId: riskSection.id,
                        color: ((risk.probability ?? 50) * (risk.consequence ?? 50)) >= 5000 ? 'pink'
                            : ((risk.probability ?? 50) * (risk.consequence ?? 50)) >= 2000 ? 'orange' : 'yellow',
                        content: risk.title,
                        mitigation: risk.mitigation || null,
                        riskScore: Math.round((risk.probability ?? 50) * (risk.consequence ?? 50) / 100),
                        xValue: risk.probability ?? 50,
                        yValue: risk.consequence ?? 50,
                        status: 'todo',
                    },
                });
            }
        }

        // Ideas matrix section + post-its
        if (improvements.length > 0) {
            const ideasSection = await prisma.section.create({
                data: { boardId: board.id, type: 'matrix', content: {} as any },
            });
            for (const [i, idea] of improvements.entries()) {
                await prisma.postit.create({
                    data: {
                        boardId: board.id,
                        sectionId: ideasSection.id,
                        color: IDEA_COLOURS[i % IDEA_COLOURS.length],
                        content: idea.title,
                        mitigation: idea.benefit || null,
                        xValue: idea.effort_score ?? 50,
                        yValue: idea.impact_score ?? 50,
                        status: 'todo',
                    },
                });
            }
        }

        // Send board invites for each invitee (non-fatal)
        if (teamMembers.length > 0) {
            await Promise.allSettled(
                teamMembers.map(m => this.shareBoard(board.id, userId, m.email))
            );
        }

        const result = { boardId: board.id, sectionId: section.id, tasksCreated };

        const boardUrl = `${config.frontend.url}/board.html?id=${result.boardId}`;
        logger.info(`Project plan imported: board ${result.boardId} with ${result.tasksCreated} tasks by user ${userId}`);
        return { ...result, boardUrl };
    }

    async shareBoard(boardId: string, currentUserId: string, email: string): Promise<void> {
        const board = await prisma.board.findUnique({ where: { id: boardId }, include: { user: true } });
        if (!board) throw new Error('Board not found');
        if (board.userId !== currentUserId) throw new Error('Only the board owner can share it');

        // If the user already exists, grant access immediately
        const userToShareWith = await prisma.user.findUnique({ where: { email } });
        if (userToShareWith) {
            await prisma.boardCollaborator.upsert({
                where: { boardId_userId: { boardId, userId: userToShareWith.id } },
                update: { permission: 'edit', acceptedAt: new Date() },
                create: { boardId, userId: userToShareWith.id, permission: 'edit', invitedBy: currentUserId, acceptedAt: new Date() },
            });
        }

        // Always embed a signed invite token in the link so new users get access on first login
        const inviteToken = jwt.sign(
            { boardId, email: email.toLowerCase(), type: 'board_invite' },
            config.jwt.secret,
            { expiresIn: '7d' } as jwt.SignOptions
        );
        const boardUrl = `${config.frontend.url}/board.html?id=${boardId}&invite=${inviteToken}`;
        await sendInviteEmail(email, boardUrl, board.title ?? '', board.user.name ?? '');
        logger.info(`Board ${boardId} shared with ${email} by user ${currentUserId}`);
    }

    async acceptBoardInvite(inviteToken: string, userId: string, userEmail: string): Promise<void> {
        const payload = jwt.verify(inviteToken, config.jwt.secret) as { boardId: string; email: string; type: string };
        if (payload.type !== 'board_invite') throw new Error('Invalid invite token');
        if (payload.email !== userEmail.toLowerCase()) throw new Error('This invite is for a different email address');

        const board = await prisma.board.findUnique({ where: { id: payload.boardId } });
        if (!board) throw new Error('Board not found');

        await prisma.boardCollaborator.upsert({
            where: { boardId_userId: { boardId: payload.boardId, userId } },
            update: { permission: 'edit', acceptedAt: new Date() },
            create: { boardId: payload.boardId, userId, permission: 'edit', acceptedAt: new Date() },
        });
        logger.info(`Board invite accepted: board ${payload.boardId} by user ${userId}`);
    }
}

export default new BoardService();
