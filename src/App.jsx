import { useState, useRef, useEffect } from 'react';
import HelpModal from './components/HelpModal.jsx';
import LangSwitcher from './components/LangSwitcher.jsx';
import BurgerMenu from './components/BurgerMenu.jsx';
import { useLang } from './i18n/LangContext.jsx';
import VoicePanel from './components/VoicePanel.jsx';
import DescriptionPanel from './components/DescriptionPanel.jsx';
import DiagramPanel from './components/DiagramPanel.jsx';
import ImprovePanel from './components/ImprovePanel.jsx';
import LaunchPanel from './components/LaunchPanel.jsx';
import {
  parseVoiceToDescription,
  parseToBpmn,
  getStructuredImprovements,
  generateProjectPlan,
  generateToBeBpmn,
} from './services/anthropicService.js';
import { generateBpmnXml } from './services/xmlGenerator.js';
import { useAileanInterviewer } from './hooks/useAileanInterviewer.js';

const DEMO_TRANSCRIPT = `Interviewer: Can you walk me through the accounts payable invoice processing workflow from start to finish?

SME: Sure. The process begins when the company receives an invoice from a vendor for goods or services. This might arrive by email, mail, or through an electronic invoicing system. The AP team then checks the invoice details against supporting documents — usually a purchase order, a goods receipt or receiving report, and the delivery confirmation. This three-way match ensures the company actually ordered the goods, received them in the correct quantity and condition, and that the pricing matches what was agreed upon.

Interviewer: What happens if the three-way match fails or documents are missing?

SME: If the invoice can't be matched, it's rejected and the vendor is notified via email — or through the same channel they used to send the invoice — and they send a corrected invoice. If the goods receipt is missing, we mark that in the ERP system and reach out internally — usually another AP clerk — to get it. We can also call the person who requested the goods or services to ask if they received them, so it becomes a manual goods receipt done by the AP clerk. We can proceed without the goods receipt if needed. If the discrepancy is more than 5%, or if the exchange rate is wrong, or the company identification number is wrong, the invoice is rejected and the vendor is contacted directly by the AP clerk.

Interviewer: Once the three-way match is verified, what comes next?

SME: Once verified, the invoice is coded to the appropriate general ledger account, cost center, or department. The AP clerk references the original purchase order for coding. If the coding information is unclear, the original requester of the order will be contacted. Then it routes through an approval workflow tiered by dollar amount — the routing happens automatically via the ERP system.

Interviewer: Can you describe the approval thresholds and who is involved at each level?

SME: Under $10,000 it's auto-approved. Invoices between $10,000 and $99,999 go to the department manager for approval. The CEO needs to be involved if the amount is $100,000 or above. The authorized managers confirm the expense and make sure it's properly categorized.

Interviewer: What happens after approval, and how does payment get processed?

SME: After approval, the invoice is auto-posted into the ERP system as an accounts payable entry — this creates a credit to accounts payable and a debit to the relevant expense or asset account. Payment is issued via check, ACH transfer, wire, virtual card, or another method as described in the vendor master data. Payments are triggered on a monthly basis. At month-end, the head of the payment team makes sure all payments are sent to the bank for transfer, and the bank issues a confirmation via email back to the head of the payment team.

Interviewer: Are there any exceptions or edge cases we should capture in the process?

SME: If a failed payment notification comes from the bank, the payment team calls the bank and handles it as an exception — this is done case by case and is very difficult to document, so we should leave it out of scope. Dropped invoices are also an exception we won't handle within the process. Vendors will always send a corrected invoice when one is rejected. Once payment is processed, the AP records are cleared by debiting AP and crediting the bank account.`;

const DEMO_PARSED = {"process_name":"Accounts Payable Invoice Processing","roles":[{"id":"role_1","name":"Accounts Payable Clerk"},{"id":"role_2","name":"Department Manager"},{"id":"role_3","name":"CEO"},{"id":"role_4","name":"Payment Team"},{"id":"role_5","name":"Head of Payment Team"},{"id":"role_6","name":"ERP System"}],"events":[{"id":"event_1","type":"start","name":"Vendor invoice received"},{"id":"event_2","type":"end","name":"Payment processed and AP cleared"},{"id":"event_3","type":"end","name":"Invoice rejected"}],"activities":[{"id":"act_1","name":"Invoice Receipt","performer":"role_1"},{"id":"act_2","name":"Three-Way Matching","performer":"role_1"},{"id":"act_3","name":"Handle Missing Documents","performer":"role_1"},{"id":"act_4","name":"Reject Invalid Invoices","performer":"role_1"},{"id":"act_5","name":"Code Invoice","performer":"role_1"},{"id":"act_6","name":"Route for Approval","performer":"role_6"},{"id":"act_7","name":"Manager Approval","performer":"role_2"},{"id":"act_8","name":"CEO Approval","performer":"role_3"},{"id":"act_9","name":"Post Accounting Entry","performer":"role_6"},{"id":"act_10","name":"Process Monthly Payments","performer":"role_4"},{"id":"act_11","name":"Authorize Payment Batch","performer":"role_5"},{"id":"act_12","name":"Clear AP Records","performer":"role_6"}],"gateways":[{"id":"gw_1","type":"exclusive","name":"Documents available?"},{"id":"gw_2","type":"exclusive","name":"Invoice valid?"},{"id":"gw_3","type":"exclusive","name":"Approval amount threshold"},{"id":"gw_4","type":"exclusive","name":"CEO approval needed?"},{"id":"gw_5","type":"exclusive","name":"Approved?"}],"sequence_flows":[{"id":"flow_1","from":"event_1","to":"act_1","condition":null},{"id":"flow_2","from":"act_1","to":"act_2","condition":null},{"id":"flow_3","from":"act_2","to":"gw_1","condition":null},{"id":"flow_4","from":"gw_1","to":"act_3","condition":"Missing documents"},{"id":"flow_5","from":"gw_1","to":"gw_2","condition":"Documents available"},{"id":"flow_6","from":"act_3","to":"gw_2","condition":null},{"id":"flow_7","from":"gw_2","to":"act_4","condition":"Invalid"},{"id":"flow_8","from":"gw_2","to":"act_5","condition":"Valid"},{"id":"flow_9","from":"act_4","to":"event_3","condition":null},{"id":"flow_10","from":"act_5","to":"act_6","condition":null},{"id":"flow_11","from":"act_6","to":"gw_3","condition":null},{"id":"flow_12","from":"gw_3","to":"act_9","condition":"Under $10,000"},{"id":"flow_13","from":"gw_3","to":"act_7","condition":"$10,000-$99,999"},{"id":"flow_14","from":"gw_3","to":"gw_4","condition":"$100,000+"},{"id":"flow_15","from":"gw_4","to":"act_8","condition":"CEO approval needed"},{"id":"flow_16","from":"act_7","to":"gw_5","condition":null},{"id":"flow_17","from":"act_8","to":"gw_5","condition":null},{"id":"flow_18","from":"gw_5","to":"act_9","condition":"Approved"},{"id":"flow_19","from":"gw_5","to":"event_3","condition":"Rejected"},{"id":"flow_20","from":"act_9","to":"act_10","condition":null},{"id":"flow_21","from":"act_10","to":"act_11","condition":null},{"id":"flow_22","from":"act_11","to":"act_12","condition":null},{"id":"flow_23","from":"act_12","to":"event_2","condition":null}]};

const DEMO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
             xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"
             targetNamespace="http://bpmn.io/schema/bpmn">
  <collaboration id="Collaboration_1">
    <participant id="Participant_1" name="Accounts Payable Invoice Processing" processRef="Process_1" />
  </collaboration>
  <process id="Process_1" isExecutable="false">
    <laneSet id="LaneSet_1">
      <lane id="role_1" name="Accounts Payable Clerk">
        <flowNodeRef>event_1</flowNodeRef><flowNodeRef>event_3</flowNodeRef>
        <flowNodeRef>act_1</flowNodeRef><flowNodeRef>act_2</flowNodeRef>
        <flowNodeRef>act_3</flowNodeRef><flowNodeRef>act_4</flowNodeRef>
        <flowNodeRef>act_5</flowNodeRef><flowNodeRef>gw_1</flowNodeRef><flowNodeRef>gw_2</flowNodeRef>
      </lane>
      <lane id="role_2" name="Department Manager">
        <flowNodeRef>act_7</flowNodeRef><flowNodeRef>gw_5</flowNodeRef>
      </lane>
      <lane id="role_3" name="CEO">
        <flowNodeRef>act_8</flowNodeRef>
      </lane>
      <lane id="role_4" name="Payment Team">
        <flowNodeRef>act_10</flowNodeRef>
      </lane>
      <lane id="role_5" name="Head of Payment Team">
        <flowNodeRef>act_11</flowNodeRef>
      </lane>
      <lane id="role_6" name="ERP System">
        <flowNodeRef>event_2</flowNodeRef><flowNodeRef>act_6</flowNodeRef>
        <flowNodeRef>act_9</flowNodeRef><flowNodeRef>act_12</flowNodeRef>
        <flowNodeRef>gw_3</flowNodeRef><flowNodeRef>gw_4</flowNodeRef>
      </lane>
    </laneSet>
    <startEvent id="event_1" name="Vendor invoice received" />
    <endEvent id="event_2" name="Payment processed and AP cleared" />
    <endEvent id="event_3" name="Invoice rejected" />
    <userTask id="act_1" name="Invoice Receipt" />
    <userTask id="act_2" name="Three-Way Matching" />
    <userTask id="act_3" name="Handle Missing Documents" />
    <userTask id="act_4" name="Reject Invalid Invoices" />
    <userTask id="act_5" name="Code Invoice" />
    <userTask id="act_6" name="Route for Approval" />
    <userTask id="act_7" name="Manager Approval" />
    <userTask id="act_8" name="CEO Approval" />
    <userTask id="act_9" name="Post Accounting Entry" />
    <userTask id="act_10" name="Process Monthly Payments" />
    <userTask id="act_11" name="Authorize Payment Batch" />
    <userTask id="act_12" name="Clear AP Records" />
    <exclusiveGateway id="gw_1" name="Documents available?" />
    <exclusiveGateway id="gw_2" name="Invoice valid?" />
    <exclusiveGateway id="gw_3" name="Approval amount threshold" />
    <exclusiveGateway id="gw_4" name="CEO approval needed?" />
    <exclusiveGateway id="gw_5" name="Approved?" />
    <sequenceFlow id="flow_1" sourceRef="event_1" targetRef="act_1" />
    <sequenceFlow id="flow_2" sourceRef="act_1" targetRef="act_2" />
    <sequenceFlow id="flow_3" sourceRef="act_2" targetRef="gw_1" />
    <sequenceFlow id="flow_4" sourceRef="gw_1" targetRef="act_3"><conditionExpression>Missing documents</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_5" sourceRef="gw_1" targetRef="gw_2"><conditionExpression>Documents available</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_6" sourceRef="act_3" targetRef="gw_2" />
    <sequenceFlow id="flow_7" sourceRef="gw_2" targetRef="act_4"><conditionExpression>Invalid</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_8" sourceRef="gw_2" targetRef="act_5"><conditionExpression>Valid</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_9" sourceRef="act_4" targetRef="event_3" />
    <sequenceFlow id="flow_10" sourceRef="act_5" targetRef="act_6" />
    <sequenceFlow id="flow_11" sourceRef="act_6" targetRef="gw_3" />
    <sequenceFlow id="flow_12" sourceRef="gw_3" targetRef="act_9"><conditionExpression>Under $10,000</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_13" sourceRef="gw_3" targetRef="act_7"><conditionExpression>$10,000-$99,999</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_14" sourceRef="gw_3" targetRef="gw_4"><conditionExpression>$100,000+</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_15" sourceRef="gw_4" targetRef="act_8"><conditionExpression>CEO approval needed</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_16" sourceRef="act_7" targetRef="gw_5" />
    <sequenceFlow id="flow_17" sourceRef="act_8" targetRef="gw_5" />
    <sequenceFlow id="flow_18" sourceRef="gw_5" targetRef="act_9"><conditionExpression>Approved</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_19" sourceRef="gw_5" targetRef="event_3"><conditionExpression>Rejected</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_20" sourceRef="act_9" targetRef="act_10" />
    <sequenceFlow id="flow_21" sourceRef="act_10" targetRef="act_11" />
    <sequenceFlow id="flow_22" sourceRef="act_11" targetRef="act_12" />
    <sequenceFlow id="flow_23" sourceRef="act_12" targetRef="event_2" />
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true"><dc:Bounds x="100" y="80" width="3060" height="1200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_1_di" bpmnElement="role_1" isHorizontal="true"><dc:Bounds x="130" y="80" width="3030" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_2_di" bpmnElement="role_2" isHorizontal="true"><dc:Bounds x="130" y="280" width="3030" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_3_di" bpmnElement="role_3" isHorizontal="true"><dc:Bounds x="130" y="480" width="3030" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_4_di" bpmnElement="role_4" isHorizontal="true"><dc:Bounds x="130" y="680" width="3030" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_5_di" bpmnElement="role_5" isHorizontal="true"><dc:Bounds x="130" y="880" width="3030" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_6_di" bpmnElement="role_6" isHorizontal="true"><dc:Bounds x="130" y="1080" width="3030" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="event_1_di" bpmnElement="event_1"><dc:Bounds x="302" y="162" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="event_2_di" bpmnElement="event_2"><dc:Bounds x="2902" y="1162" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="event_3_di" bpmnElement="event_3"><dc:Bounds x="2502" y="162" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_1_di" bpmnElement="act_1"><dc:Bounds x="470" y="140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_2_di" bpmnElement="act_2"><dc:Bounds x="670" y="140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_3_di" bpmnElement="act_3"><dc:Bounds x="1070" y="140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_4_di" bpmnElement="act_4"><dc:Bounds x="1470" y="140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_5_di" bpmnElement="act_5"><dc:Bounds x="1670" y="140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_6_di" bpmnElement="act_6"><dc:Bounds x="1670" y="1140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_7_di" bpmnElement="act_7"><dc:Bounds x="2070" y="340" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_8_di" bpmnElement="act_8"><dc:Bounds x="2270" y="540" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_9_di" bpmnElement="act_9"><dc:Bounds x="2470" y="1140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_10_di" bpmnElement="act_10"><dc:Bounds x="2270" y="740" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_11_di" bpmnElement="act_11"><dc:Bounds x="2470" y="940" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_12_di" bpmnElement="act_12"><dc:Bounds x="2670" y="1140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw_1_di" bpmnElement="gw_1"><dc:Bounds x="895" y="155" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw_2_di" bpmnElement="gw_2"><dc:Bounds x="1295" y="155" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw_3_di" bpmnElement="gw_3"><dc:Bounds x="1895" y="1155" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw_4_di" bpmnElement="gw_4"><dc:Bounds x="2095" y="1155" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw_5_di" bpmnElement="gw_5"><dc:Bounds x="2495" y="355" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow_1_di" bpmnElement="flow_1"><di:waypoint x="338" y="180" /><di:waypoint x="470" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_2_di" bpmnElement="flow_2"><di:waypoint x="570" y="180" /><di:waypoint x="670" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_3_di" bpmnElement="flow_3"><di:waypoint x="770" y="180" /><di:waypoint x="895" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_4_di" bpmnElement="flow_4"><di:waypoint x="945" y="180" /><di:waypoint x="1070" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_5_di" bpmnElement="flow_5"><di:waypoint x="945" y="180" /><di:waypoint x="1295" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_6_di" bpmnElement="flow_6"><di:waypoint x="1170" y="180" /><di:waypoint x="1295" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_7_di" bpmnElement="flow_7"><di:waypoint x="1345" y="180" /><di:waypoint x="1470" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_8_di" bpmnElement="flow_8"><di:waypoint x="1345" y="180" /><di:waypoint x="1670" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_9_di" bpmnElement="flow_9"><di:waypoint x="1570" y="180" /><di:waypoint x="2502" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_10_di" bpmnElement="flow_10"><di:waypoint x="1770" y="180" /><di:waypoint x="1820" y="180" /><di:waypoint x="1820" y="1180" /><di:waypoint x="1670" y="1180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_11_di" bpmnElement="flow_11"><di:waypoint x="1770" y="1180" /><di:waypoint x="1895" y="1180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_12_di" bpmnElement="flow_12"><di:waypoint x="1945" y="1180" /><di:waypoint x="2470" y="1180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_13_di" bpmnElement="flow_13"><di:waypoint x="1945" y="1180" /><di:waypoint x="2008" y="1180" /><di:waypoint x="2008" y="380" /><di:waypoint x="2070" y="380" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_14_di" bpmnElement="flow_14"><di:waypoint x="1945" y="1180" /><di:waypoint x="2095" y="1180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_15_di" bpmnElement="flow_15"><di:waypoint x="2145" y="1180" /><di:waypoint x="2208" y="1180" /><di:waypoint x="2208" y="580" /><di:waypoint x="2270" y="580" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_16_di" bpmnElement="flow_16"><di:waypoint x="2170" y="380" /><di:waypoint x="2495" y="380" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_17_di" bpmnElement="flow_17"><di:waypoint x="2370" y="580" /><di:waypoint x="2433" y="580" /><di:waypoint x="2433" y="380" /><di:waypoint x="2495" y="380" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_18_di" bpmnElement="flow_18"><di:waypoint x="2545" y="380" /><di:waypoint x="2508" y="380" /><di:waypoint x="2508" y="1180" /><di:waypoint x="2470" y="1180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_19_di" bpmnElement="flow_19"><di:waypoint x="2545" y="380" /><di:waypoint x="2524" y="380" /><di:waypoint x="2524" y="180" /><di:waypoint x="2502" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_20_di" bpmnElement="flow_20"><di:waypoint x="2570" y="1180" /><di:waypoint x="2620" y="1180" /><di:waypoint x="2620" y="780" /><di:waypoint x="2270" y="780" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_21_di" bpmnElement="flow_21"><di:waypoint x="2370" y="780" /><di:waypoint x="2420" y="780" /><di:waypoint x="2420" y="980" /><di:waypoint x="2470" y="980" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_22_di" bpmnElement="flow_22"><di:waypoint x="2570" y="980" /><di:waypoint x="2620" y="980" /><di:waypoint x="2620" y="1180" /><di:waypoint x="2670" y="1180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_23_di" bpmnElement="flow_23"><di:waypoint x="2770" y="1180" /><di:waypoint x="2902" y="1180" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

const DEMO_DESCRIPTION = {"process_name":"Accounts Payable Invoice Processing","overview":"This process handles the complete lifecycle of vendor invoice processing, from receipt through payment. It begins when the company receives a vendor invoice and includes verification through three-way matching, approval workflows based on dollar thresholds, and monthly payment processing. The process ensures proper validation of invoices against supporting documents before payment.","scope":"The process covers invoice receipt, three-way matching validation, coding to general ledger accounts, tiered approval workflows, and payment processing. Out of scope are detailed exception handling procedures, specific failed payment resolution steps, and dropped invoice scenarios.","roles":[{"name":"Accounts Payable Clerk","responsibilities":"Receives invoices, performs three-way matching, handles rejections and communications with vendors, codes invoices to appropriate accounts, manages exceptions, and contacts internal requesters for missing information"},{"name":"Department Manager","responsibilities":"Approves invoices over $10,000, confirms expenses are properly categorized, and can reject invoices that require vendor correction"},{"name":"CEO","responsibilities":"Approves invoices over $100,000, provides final authorization for high-value transactions"},{"name":"Payment Team","responsibilities":"Processes monthly payments to vendors using various payment methods as specified in vendor master data"},{"name":"Head of Payment Team","responsibilities":"Reviews and authorizes payment batches before sending to bank, receives bank confirmation notifications"}],"steps":[{"order":1,"name":"Invoice Receipt","performer":"Accounts Payable Clerk","description":"Company receives vendor invoice via email, mail, or electronic invoicing system for goods or services"},{"order":2,"name":"Three-Way Matching","performer":"Accounts Payable Clerk","description":"Check invoice details against supporting documents including purchase order, goods receipt, and delivery confirmation to ensure company ordered goods, received correct quantity/condition, and pricing matches agreement"},{"order":3,"name":"Handle Missing Documents","performer":"Accounts Payable Clerk","description":"If goods receipt is missing, mark it in ERP system, reach out to other AP clerks or contact original requester for manual verification based on dollar thresholds"},{"order":4,"name":"Reject Invalid Invoices","performer":"Accounts Payable Clerk","description":"Reject invoices with discrepancies over 5%, wrong exchange rates, or incorrect company identification codes, and notify vendor via email with specific error details"},{"order":5,"name":"Code Invoice","performer":"Accounts Payable Clerk","description":"Code verified invoices to appropriate general ledger accounts, cost centers, or departments using purchase order as reference, contacting original requester if coding information is unclear"},{"order":6,"name":"Route for Approval","performer":"ERP System","description":"Automatically route invoices through tiered approval workflow: under $10,000 auto-approved, $10,000+ to department manager, $100,000+ to CEO"},{"order":7,"name":"Manager Approval","performer":"Department Manager/CEO","description":"Authorized managers review and approve expenses, confirm proper categorization, or reject invoices that require vendor correction"},{"order":8,"name":"Post Accounting Entry","performer":"ERP System","description":"After approval, automatically post invoice as accounts payable entry, creating credit to AP and debit to relevant expense or asset account"},{"order":9,"name":"Process Monthly Payments","performer":"Payment Team","description":"At month-end, process all approved invoices for payment using methods specified in vendor master data (check, ACH, wire, virtual card)"},{"order":10,"name":"Authorize Payment Batch","performer":"Head of Payment Team","description":"Review and authorize payment batch before sending to bank"},{"order":11,"name":"Clear AP Records","performer":"ERP System","description":"After payment processing, clear accounts payable records by debiting AP and crediting bank account, receive bank confirmation via email"}],"exceptions":["Three-way match failures requiring vendor invoice correction","Missing supporting documents requiring manual verification","Manager rejection of approved invoices","Failed bank payments requiring case-by-case resolution with bank","Dropped invoices that vendors don't correct"],"known_issues":["Payment failures require manual intervention and bank contact","Manual goods receipt verification process when system receipts are missing","Complex exception handling for various types of invoice discrepancies"]};

const DEMO_IMPROVEMENTS = [
  { id: 'imp_1', title: 'Implement OCR and AI-powered Invoice Data Extraction', category: 'automation', effort: 'high', effort_score: 80, impact_score: 85, description: 'Deploy optical character recognition (OCR) and machine learning to automatically extract invoice data, reducing manual data entry and improving accuracy in invoice receipt and coding activities', benefit: 'Reduces processing time by 60-70%, eliminates data entry errors, and frees up AP clerks for higher-value tasks' },
  { id: 'imp_2', title: 'Establish Real-time Invoice Status Dashboard', category: 'clarity', effort: 'medium', effort_score: 45, impact_score: 70, description: 'Create a centralized dashboard showing invoice status, approval bottlenecks, and aging reports visible to all stakeholders in the process', benefit: 'Improves visibility, reduces status inquiry calls, and enables proactive management of payment deadlines and cash flow' },
  { id: 'imp_3', title: 'Automate Three-Way Matching Process', category: 'automation', effort: 'medium', effort_score: 55, impact_score: 75, description: 'Implement automated matching of invoices with purchase orders and receiving documents using ERP system capabilities and exception-based processing', benefit: 'Reduces manual matching time by 80%, improves accuracy, and allows straight-through processing for exact matches' },
  { id: 'imp_4', title: 'Implement Dynamic Approval Workflows', category: 'governance', effort: 'medium', effort_score: 50, impact_score: 65, description: 'Create configurable approval routing based on vendor, category, department, and amount with automatic escalation for delayed approvals', benefit: 'Reduces approval cycle time, ensures proper authorization controls, and minimizes bottlenecks from absent approvers' },
  { id: 'imp_5', title: 'Optimize Payment Processing Frequency', category: 'efficiency', effort: 'low', effort_score: 25, impact_score: 60, description: 'Move from monthly to weekly payment runs with automated payment scheduling based on terms and early payment discounts', benefit: 'Improves vendor relationships, captures early payment discounts, and optimizes cash flow management' },
  { id: 'imp_6', title: 'Establish Vendor Portal for Self-Service', category: 'efficiency', effort: 'high', effort_score: 75, impact_score: 70, description: 'Deploy a vendor portal allowing suppliers to submit invoices electronically and track payment status', benefit: 'Reduces manual invoice handling, improves vendor satisfaction, and decreases inquiry volume by 40-50%' },
  { id: 'imp_7', title: 'Implement Exception-Based Processing Controls', category: 'risk', effort: 'medium', effort_score: 45, impact_score: 65, description: 'Define clear tolerance levels for invoice variances and automate processing of invoices within acceptable limits while flagging exceptions for review', benefit: 'Reduces processing time for routine invoices while maintaining control over exceptions and potential fraud' },
];

const DEMO_SELECTED_IDS = ['imp_2', 'imp_1', 'imp_3', 'imp_5', 'imp_6'];

const DEMO_PROJECT_PLAN = {"plan_name":"Accounts Payable Invoice Processing Transformation","duration_weeks":14,"tracks":[{"id":"track_1","name":"Technology & Automation"},{"id":"track_2","name":"Process Optimization"},{"id":"track_3","name":"Vendor Management"},{"id":"track_4","name":"Monitoring & Control"}],"tasks":[{"id":"task_1","title":"Conduct OCR/AI solution vendor evaluation and selection","track_id":"track_1","week_start":1,"week_end":3,"owner":"IT Manager","improvement_id":"imp_1"},{"id":"task_2","title":"Design and configure OCR data extraction workflows","track_id":"track_1","week_start":4,"week_end":7,"owner":"Technical Lead","improvement_id":"imp_1"},{"id":"task_3","title":"Deploy OCR system and conduct user acceptance testing","track_id":"track_1","week_start":8,"week_end":10,"owner":"Implementation Team","improvement_id":"imp_1"},{"id":"task_4","title":"Configure ERP system for automated three-way matching","track_id":"track_1","week_start":2,"week_end":5,"owner":"ERP Administrator","improvement_id":"imp_3"},{"id":"task_5","title":"Test automated matching rules and exception handling","track_id":"track_1","week_start":6,"week_end":8,"owner":"AP Process Owner","improvement_id":"imp_3"},{"id":"task_6","title":"Analyze current payment cycles and discount opportunities","track_id":"track_2","week_start":1,"week_end":2,"owner":"AP Manager","improvement_id":"imp_5"},{"id":"task_7","title":"Redesign payment scheduling and approval workflows","track_id":"track_2","week_start":3,"week_end":5,"owner":"Process Analyst","improvement_id":"imp_5"},{"id":"task_8","title":"Implement weekly payment runs with automated scheduling","track_id":"track_2","week_start":6,"week_end":8,"owner":"Payment Team Lead","improvement_id":"imp_5"},{"id":"task_9","title":"Evaluate and select vendor portal platform","track_id":"track_3","week_start":1,"week_end":3,"owner":"Vendor Relations Manager","improvement_id":"imp_6"},{"id":"task_10","title":"Configure vendor portal and integration with ERP","track_id":"track_3","week_start":4,"week_end":8,"owner":"IT Solutions Architect","improvement_id":"imp_6"},{"id":"task_11","title":"Onboard priority vendors to self-service portal","track_id":"track_3","week_start":9,"week_end":12,"owner":"Vendor Onboarding Team","improvement_id":"imp_6"},{"id":"task_12","title":"Design real-time dashboard requirements and mockups","track_id":"track_4","week_start":2,"week_end":4,"owner":"Business Analyst","improvement_id":"imp_2"},{"id":"task_13","title":"Develop and deploy invoice status dashboard","track_id":"track_4","week_start":5,"week_end":9,"owner":"Dashboard Developer","improvement_id":"imp_2"},{"id":"task_14","title":"Train all stakeholders on new systems and processes","track_id":"track_4","week_start":10,"week_end":12,"owner":"Training Coordinator","improvement_id":"imp_1"},{"id":"task_15","title":"Monitor performance and optimize system configuration","track_id":"track_4","week_start":13,"week_end":14,"owner":"Process Excellence Team","improvement_id":"imp_2"}],"risks":[{"id":"risk_1","title":"OCR accuracy issues with non-standard invoice formats","probability":70,"consequence":60,"mitigation":"Implement comprehensive testing with diverse invoice samples and establish manual review processes for low-confidence extractions"},{"id":"risk_2","title":"ERP system integration complexity","probability":60,"consequence":75,"mitigation":"Engage ERP vendor support early and conduct phased rollout with parallel processing initially"},{"id":"risk_3","title":"Vendor adoption resistance for self-service portal","probability":65,"consequence":50,"mitigation":"Develop vendor incentive programs and provide dedicated support during transition period"},{"id":"risk_4","title":"Staff resistance to automated processes","probability":55,"consequence":65,"mitigation":"Implement comprehensive change management program with retraining for higher-value activities"},{"id":"risk_5","title":"Dashboard performance issues with large data volumes","probability":45,"consequence":40,"mitigation":"Implement data caching strategies and optimize database queries during development phase"}]};

// Draggable divider between two panel wrappers.
function ResizeHandle({ aRef, bRef, disabled, aKey, bKey, onDragEnd }) {
  const [active, setActive] = useState(false);

  function handleMouseDown(e) {
    if (disabled) return;
    e.preventDefault();
    setActive(true);

    const startX = e.clientX;
    const aEl = aRef.current;
    const bEl = bRef.current;
    const aStart = aEl.getBoundingClientRect().width;
    const bStart = bEl.getBoundingClientRect().width;
    const MIN = 160;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev) {
      const delta = ev.clientX - startX;
      const newA = Math.max(MIN, Math.min(aStart + delta, aStart + bStart - MIN));
      const newB = aStart + bStart - newA;
      aEl.style.flex = 'none';
      aEl.style.width = newA + 'px';
      bEl.style.flex = 'none';
      bEl.style.width = newB + 'px';
    }

    function onUp() {
      setActive(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const finalA = aEl.getBoundingClientRect().width;
      const finalB = bEl.getBoundingClientRect().width;
      onDragEnd(aKey, finalA, bKey, finalB);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  if (disabled) {
    return <div className="shrink-0 border-r border-gray-700" style={{ width: 0 }} />;
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{ width: 5, flexShrink: 0 }}
      className={[
        'border-r border-gray-700 cursor-col-resize transition-colors',
        active ? 'border-green-500/60 bg-green-500/20' : 'hover:border-green-500/50 hover:bg-green-500/10',
      ].join(' ')}
    />
  );
}

function PanelShell({ num, label, action, collapsed, onToggle, children }) {
  const { t } = useLang();
  if (collapsed) {
    return (
      <div
        className="flex flex-col h-full bg-gray-900 cursor-pointer select-none"
        onClick={onToggle}
        title={`Expand ${label}`}
      >
        <div className="flex-1 flex items-center justify-center">
          <div
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors py-4"
          >
            <span className="text-xs font-mono">{num}</span>
            <span className="text-xs font-medium tracking-wide">{label}</span>
          </div>
        </div>
        <div className="pb-3 flex justify-center">
          <span className="text-gray-600 text-xs">›</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-3 bg-gray-900 text-white shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400">{num}</span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button
            onClick={onToggle}
            title={t.collapsePanel}
            className="text-gray-500 hover:text-white transition-colors text-xs px-1"
          >
            ‹
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col bg-white">
        {children}
      </div>
    </div>
  );
}

const DRAFT_KEY = 'voice2bpmn_draft';

// Build a structured "Interviewer / SME" transcript from Ailean conversation turns.
function buildStructuredTranscript(turns, currentDraft) {
  const parts = turns.map(turn =>
    turn.type === 'ailean'
      ? `Interviewer: ${turn.text}`
      : `SME: ${turn.text}`
  );
  if (currentDraft?.trim()) {
    parts.push(`SME: ${currentDraft.trim()}`);
  }
  return parts.join('\n\n');
}

export default function App() {
  const { t } = useLang();
  const [apiKey, setApiKey] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showBurger, setShowBurger] = useState(false);

  // ── Custom taxonomy (overrides APQC in ApqcSelector) ──────────────
  const [customTaxonomyNodes, setCustomTaxonomyNodes] = useState(() => {
    try {
      const s = localStorage.getItem('voice2bpmn_custom_taxonomy');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  // ── vimpl login state ──────────────────────────────────────────────
  const VIMPL_STORAGE_KEY = 'voice2bpmn_vimpl_config';
  const VIMPL_LOGIN_URL = 'https://frontend-puce-ten-18.vercel.app/login.html';
  const BACKEND_URL = 'https://backend-eight-rho-46.vercel.app';
  const [vimplToken, setVimplToken] = useState(() => {
    try { return JSON.parse(localStorage.getItem(VIMPL_STORAGE_KEY) || '{}').token || null; }
    catch { return null; }
  });
  const [collapsed, setCollapsed] = useState({ 1: false, 2: false, 3: false, 4: false, 5: false, 6: true });
  // Widths stored as fractions (0–1) of the flex container so redistribution is
  // always proportional and never dependent on a measured pixel value.
  const [panelWidths, setPanelWidths] = useState({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null });
  const [draftRestored, setDraftRestored] = useState(false);

  const p1Ref = useRef(null);
  const p2Ref = useRef(null);
  const p3Ref = useRef(null);
  const p4Ref = useRef(null);
  const p5Ref = useRef(null);
  const p6Ref = useRef(null);
  const pRefs = { 1: p1Ref, 2: p2Ref, 3: p3Ref, 4: p4Ref, 5: p5Ref, 6: p6Ref };

  // All panels share space equally (flex:1) when all are open.
  // When any panel collapses, non-Map panels are frozen at their current pixel
  // width and Map (panel 3) flexes to fill all freed space.
  function getPanelStyle(n) {
    if (collapsed[n]) return { width: 36, flexShrink: 0, flexGrow: 0 };
    const w = panelWidths[n];
    if (w != null) return { flex: 'none', width: w, minWidth: '20%' };
    return { flex: 1, minWidth: '20%' };
  }

  function handleDragEnd(aKey, newA, bKey, newB) {
    setPanelWidths(prev => ({ ...prev, [aKey]: newA, [bKey]: newB }));
  }

  function togglePanel(n) {
    const nextCollapsed = { ...collapsed, [n]: !collapsed[n] };
    const anyCollapsed = Object.values(nextCollapsed).some(Boolean);

    [p1Ref, p2Ref, p3Ref, p4Ref, p5Ref, p6Ref].forEach(r => {
      if (r.current) r.current.style.cssText = '';
    });

    if (anyCollapsed) {
      // Freeze non-Map panels at their current rendered width; Map fills the rest
      const newWidths = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
      [1, 2, 4, 5, 6].forEach(p => {
        if (!nextCollapsed[p] && pRefs[p].current) {
          newWidths[p] = pRefs[p].current.offsetWidth;
        }
      });
      // panel 3 (Map) stays null → flex:1 → fills remainder
      setPanelWidths(newWidths);
    } else {
      // All open → reset to equal widths
      setPanelWidths({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null });
    }

    setCollapsed(nextCollapsed);
  }

  // Process context
  const [processContext, setProcessContext] = useState({
    apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null,
  });

  // Panel 1 — Voice
  const [transcript, setTranscript] = useState('');
  const [descParsing, setDescParsing] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  // ── Ailean AI Interviewer ──────────────────────────────────────────
  const ailean = useAileanInterviewer({ apiKey, elevenLabsKey, processContext });

  // Panel 2 — Description
  const [processDescription, setProcessDescription] = useState(null);
  const [bpmnParsing, setBpmnParsing] = useState(false);

  // Panel 3 — Diagram (parsed BPMN JSON + XML)
  const [parsed, setParsed] = useState(null);
  const [xml, setXml] = useState(null);

  // Panel 4 — Plan
  const [improvements, setImprovements] = useState(null);
  const [selectedImprovementIds, setSelectedImprovementIds] = useState([]);
  const [customRisks, setCustomRisks] = useState([]);
  const [projectPlan, setProjectPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);

  // Panel 3 — AS-IS / TO-BE
  const [asIsXml, setAsIsXml] = useState(null);
  const [asIsParsed, setAsIsParsed] = useState(null);
  const [toBeXml, setToBeXml] = useState(null);
  const [toBeParsed, setToBeParsed] = useState(null);
  const [toBeLoading, setToBeLoading] = useState(false);

  // ── Auto-login: read token from ?token= (vimpl SSO callback) or #token= (board deep-link) ──
  useEffect(() => {
    try {
      // Query param — set by vimpl login callback
      const qParams = new URLSearchParams(window.location.search);
      const qToken = qParams.get('token');
      // Hash param — set by vimpl board burger menu
      const hParams = new URLSearchParams(window.location.hash.slice(1));
      const hToken = hParams.get('token');
      const hBaseUrl = hParams.get('baseUrl');
      const token = qToken || hToken;
      if (token) {
        const existing = JSON.parse(localStorage.getItem(VIMPL_STORAGE_KEY) || '{}');
        localStorage.setItem(VIMPL_STORAGE_KEY, JSON.stringify({
          ...existing,
          token,
          ...(hBaseUrl ? { baseUrl: hBaseUrl } : {}),
        }));
        setVimplToken(token);
        // Clean token from URL
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function loginWithGoogle() {
    // Backend decodes state as plain base64 URL, then redirects to ${state}/callback.html?token=...
    const state = btoa(window.location.origin);
    window.location.href = `${BACKEND_URL}/api/v1/auth/google?state=${encodeURIComponent(state)}`;
  }

  function loginWithVimpl() {
    const returnTo = window.location.href.split('?')[0];
    window.location.href = `${VIMPL_LOGIN_URL}?returnTo=${encodeURIComponent(returnTo)}`;
  }

  function logoutVimpl() {
    localStorage.removeItem(VIMPL_STORAGE_KEY);
    setVimplToken(null);
  }

  // ── Restore draft from localStorage on mount ──────────────────────
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (!saved) return;
      if (saved.transcript) setTranscript(saved.transcript);
      if (saved.processDescription) setProcessDescription(saved.processDescription);
      if (saved.parsed) setParsed(saved.parsed);
      if (saved.xml) setXml(saved.xml);
      if (saved.improvements) setImprovements(saved.improvements);
      if (saved.selectedImprovementIds) setSelectedImprovementIds(saved.selectedImprovementIds);
      if (saved.customRisks) setCustomRisks(saved.customRisks);
      if (saved.projectPlan) setProjectPlan(saved.projectPlan);
      if (saved.processContext) setProcessContext(saved.processContext);
      setDraftRestored(true);
      setTimeout(() => setDraftRestored(false), 3000);
    } catch { /* ignore corrupt drafts */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save draft whenever key state changes ────────────────────
  useEffect(() => {
    if (!transcript && !xml && !parsed) return; // nothing worth saving yet
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        transcript, processDescription, parsed, xml,
        improvements, selectedImprovementIds, customRisks, projectPlan, processContext,
      }));
    } catch { /* storage full or unavailable */ }
  }, [transcript, processDescription, parsed, xml, improvements, selectedImprovementIds, customRisks, projectPlan, processContext]);

  function handleClearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setTranscript('');
    setProcessDescription(null);
    setParsed(null);
    setXml(null);
    setImprovements(null);
    setSelectedImprovementIds([]);
    setCustomRisks([]);
    setProjectPlan(null);
    setAsIsXml(null);
    setAsIsParsed(null);
    setToBeXml(null);
    setToBeParsed(null);
    setProcessContext({ apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null });
  }

  function handleLoadDemo() {
    setTranscript(DEMO_TRANSCRIPT);
    setParsed(DEMO_PARSED);
    setProcessDescription(DEMO_DESCRIPTION);
    setProcessContext({ apqcNodeId: '8.6', apqcNodeName: 'Process accounts payable and expense reimbursements', isCustom: false, customLabel: null });
    setXml(DEMO_XML);
    setVoiceError(null);
    setImprovements(DEMO_IMPROVEMENTS);
    setSelectedImprovementIds(DEMO_SELECTED_IDS);
    setProjectPlan(DEMO_PROJECT_PLAN);
    setCustomRisks([]);
  }

  // If Ailean interviewed, build a structured transcript; otherwise use raw text.
  function getEffectiveTranscript() {
    if (ailean.enabled && ailean.turns.length > 0) {
      const currentDraft = transcript.slice(ailean.prevTranscriptLength);
      return buildStructuredTranscript(ailean.turns, currentDraft);
    }
    return transcript;
  }

  async function handleParseVoice() {
    setDescParsing(true);
    setVoiceError(null);
    setProcessDescription(null);
    setParsed(null);
    setXml(null);
    setImprovements(null);
    setSelectedImprovementIds([]);
    setProjectPlan(null);
    try {
      const desc = await parseVoiceToDescription(getEffectiveTranscript(), apiKey, processContext);
      setProcessDescription(desc);
    } catch (err) {
      setVoiceError(err.message || 'Failed to parse voice.');
    } finally {
      setDescParsing(false);
    }
  }

  async function handleApproveToBpmn() {
    setBpmnParsing(true);
    setParsed(null);
    setXml(null);
    setImprovements(null);
    setSelectedImprovementIds([]);
    setProjectPlan(null);
    try {
      const bpmnJson = await parseToBpmn(processDescription, apiKey, processContext);
      setParsed(bpmnJson);
      const generatedXml = generateBpmnXml(bpmnJson);
      setXml(generatedXml);
    } finally {
      setBpmnParsing(false);
    }
  }

  async function handleGetImprovements() {
    const result = await getStructuredImprovements(parsed, apiKey);
    setImprovements(result);
    setSelectedImprovementIds([]);
  }

  function handleAddImprovement(idea) {
    setImprovements(prev => [...(prev || []), idea]);
    setSelectedImprovementIds(prev => [...prev, idea.id]);
  }

  function handleUpdateImprovement(updated) {
    setImprovements(prev => prev.map(i => i.id === updated.id ? updated : i));
  }

  function handleAddRisk(risk) {
    setCustomRisks(prev => [...prev, risk]);
  }

  function handleUpdateRisk(updated) {
    setCustomRisks(prev => prev.map(r => r.id === updated.id ? updated : r));
  }

  function handleRemoveRisk(id) {
    setCustomRisks(prev => prev.filter(r => r.id !== id));
  }

  function handleToggleSelect(id) {
    setSelectedImprovementIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleGeneratePlan() {
    const selected = (improvements || []).filter(i => selectedImprovementIds.includes(i.id));
    if (!selected.length) return;

    // Freeze AS-IS and kick off both in parallel
    setAsIsXml(xml);
    setAsIsParsed(parsed);
    setToBeXml(null);
    setToBeParsed(null);
    setToBeLoading(true);
    setPlanLoading(true);

    try {
      const [plan, toBeParsedResult] = await Promise.all([
        generateProjectPlan(parsed, selected, apiKey, customRisks),
        generateToBeBpmn(parsed, selected, apiKey),
      ]);
      setProjectPlan(plan);
      setToBeParsed(toBeParsedResult);
      const { generateBpmnXml } = await import('./services/xmlGenerator.js');
      setToBeXml(generateBpmnXml(toBeParsedResult));
    } finally {
      setPlanLoading(false);
      setToBeLoading(false);
    }
  }

  const handleProps = { onDragEnd: handleDragEnd };

  // ── Login gate ────────────────────────────────────────────────────
  if (!vimplToken) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-900 gap-6">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-semibold text-white tracking-wide">{t.appTitle}</h1>
          <a href="https://www.ailean.dk" target="_blank" rel="noopener noreferrer" className="ailean-badge">
            <span>Powered by</span>
            <span className="ailean-logo">AILEAN</span>
          </a>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 w-80">
          <p className="text-sm text-gray-500 text-center">Sign in to continue</p>

          {/* Google — primary */}
          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="w-full flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* vimpl email/password — secondary */}
          <button
            onClick={loginWithVimpl}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign in with vimpl account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white tracking-wide">{t.appTitle}</h1>
          <a
            href="https://www.ailean.dk"
            target="_blank"
            rel="noopener noreferrer"
            className="ailean-badge"
          >
            <span>Powered by</span>
            <span className="ailean-logo">AILEAN</span>
          </a>
        </div>
        <div className="flex items-center gap-2">
          {draftRestored && (
            <span className="text-xs text-green-400 animate-pulse">{t.draftRestored}</span>
          )}
          {(transcript || xml) && (
            <button
              onClick={handleClearDraft}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              title={t.clearTitle}
            >
              {t.clear}
            </button>
          )}
          <LangSwitcher />
          <button
            onClick={() => setShowBurger(true)}
            className="flex flex-col gap-1 items-center justify-center w-8 h-8 rounded hover:bg-gray-700 transition-colors"
            title="Settings"
          >
            <span className="w-4 h-0.5 bg-gray-300 rounded" />
            <span className="w-4 h-0.5 bg-gray-300 rounded" />
            <span className="w-4 h-0.5 bg-gray-300 rounded" />
          </button>
        </div>
      </header>

      {/* 5-panel layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Panel 1 — Voice */}
        <div ref={p1Ref} style={getPanelStyle(1)} className="overflow-hidden">
          <PanelShell num="1" label={t.panel1} collapsed={collapsed[1]} onToggle={() => togglePanel(1)}>
            {voiceError && (
              <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 text-xs shrink-0">
                {voiceError}
              </div>
            )}
            <VoicePanel
              transcript={transcript}
              setTranscript={setTranscript}
              effectiveTranscript={getEffectiveTranscript()}
              onParse={handleParseVoice}
              loading={descParsing}
              canParse={!!getEffectiveTranscript().trim() && !!apiKey}
              onLoadDemo={handleLoadDemo}
              ailean={ailean}
              onAileanTurn={() => ailean.askFollowUp(transcript)}
            />
          </PanelShell>
        </div>

        <ResizeHandle aRef={pRefs[1]} bRef={pRefs[2]} disabled={collapsed[1] || collapsed[2]}
          aKey={1} bKey={2} {...handleProps} />

        {/* Panel 2 — Description */}
        <div ref={p2Ref} style={getPanelStyle(2)} className="overflow-hidden">
          <PanelShell num="2" label={t.panel2} collapsed={collapsed[2]} onToggle={() => togglePanel(2)}>
            <DescriptionPanel
              description={processDescription}
              onDescriptionChange={setProcessDescription}
              onApprove={handleApproveToBpmn}
              loading={descParsing}
              canApprove={!!processDescription && !!apiKey && !bpmnParsing}
              processContext={processContext}
              onProcessContextChange={setProcessContext}
              taxonomyNodes={customTaxonomyNodes}
            />
          </PanelShell>
        </div>

        <ResizeHandle aRef={pRefs[2]} bRef={pRefs[3]} disabled={collapsed[2] || collapsed[3]}
          aKey={2} bKey={3} {...handleProps} />

        {/* Panel 3 — Diagram */}
        <div ref={p3Ref} style={getPanelStyle(3)} className="overflow-hidden">
          <PanelShell num="3" label={t.panel3} collapsed={collapsed[3]} onToggle={() => togglePanel(3)}>
            <DiagramPanel
              xml={xml}
              onXmlChange={setXml}
              bpmnLoading={bpmnParsing}
              processName={parsed?.process_name}
              parsed={parsed}
              processDescription={processDescription}
              onGetImprovements={handleGetImprovements}
              apiKey={apiKey}
              asIsXml={asIsXml}
              toBeXml={toBeXml}
              onToBeXmlChange={setToBeXml}
              toBeLoading={toBeLoading}
            />
          </PanelShell>
        </div>

        <ResizeHandle aRef={pRefs[3]} bRef={pRefs[4]} disabled={collapsed[3] || collapsed[4]}
          aKey={3} bKey={4} {...handleProps} />

        {/* Panel 4 — Project */}
        <div ref={p4Ref} style={getPanelStyle(4)} className="overflow-hidden">
          <PanelShell num="4" label={t.panel4} collapsed={collapsed[4]} onToggle={() => togglePanel(4)}>
            <ImprovePanel
              parsed={parsed}
              apiKey={apiKey}
              improvements={improvements}
              onGetImprovements={handleGetImprovements}
              onAddImprovement={handleAddImprovement}
              onUpdateImprovement={handleUpdateImprovement}
              selectedIds={selectedImprovementIds}
              onToggleSelect={handleToggleSelect}
              projectPlan={projectPlan}
              onGeneratePlan={handleGeneratePlan}
              planLoading={planLoading}
            />
          </PanelShell>
        </div>

        <ResizeHandle aRef={pRefs[4]} bRef={pRefs[5]} disabled={collapsed[4] || collapsed[5]}
          aKey={4} bKey={5} {...handleProps} />

        {/* Panel 5 — Launch */}
        <div ref={p5Ref} style={getPanelStyle(5)} className="overflow-hidden">
          <PanelShell num="5" label={t.panel5} collapsed={collapsed[5]} onToggle={() => togglePanel(5)}>
            <LaunchPanel
              projectPlan={projectPlan}
              parsed={parsed}
              processDescription={processDescription}
              improvements={improvements}
              selectedIds={selectedImprovementIds}
              customRisks={customRisks}
              onAddRisk={handleAddRisk}
              onUpdateRisk={handleUpdateRisk}
              onRemoveRisk={handleRemoveRisk}
            />
          </PanelShell>
        </div>

      </div>

      <BurgerMenu
        open={showBurger}
        onClose={() => setShowBurger(false)}
        apiKey={apiKey}
        onApiKeyChange={key => { setApiKey(key); }}
        elevenLabsKey={elevenLabsKey}
        onElevenLabsKeyChange={key => { setElevenLabsKey(key); }}
        vimplToken={vimplToken}
        onLoginGoogle={loginWithGoogle}
        onLoginVimpl={loginWithVimpl}
        onLogout={logoutVimpl}
        parsed={parsed}
        processContext={processContext}
        customTaxonomyNodes={customTaxonomyNodes}
        onTaxonomyChange={setCustomTaxonomyNodes}
      />

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
