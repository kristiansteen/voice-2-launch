// ── Dansk demo-flow ───────────────────────────────────────────────────────────
// Behandling af kreditorfakturaer — bruges til demo-tilstand i App.jsx (dansk).

export const DA_DEMO_TRANSCRIPT = `Interviewer: Kan du gennemgå processen for behandling af kreditorfakturaer fra start til slut?

SME: Selvfølgelig. Processen begynder, når virksomheden modtager en faktura fra en leverandør for varer eller tjenesteydelser. Den kan ankomme via e-mail, post eller gennem et elektronisk faktureringssystem. Kreditorteamet tjekker derefter fakturadetaljerne op imod støttedokumenter — typisk en indkøbsordre, en varemodtagelse og leveringsbekræftelsen. Tre-vejsmatchen sikrer, at virksomheden faktisk har bestilt varerne, modtaget dem i korrekt antal og stand, og at prisen svarer til det aftalte.

Interviewer: Hvad sker der, hvis tre-vejsmatchen fejler, eller der mangler dokumenter?

SME: Hvis fakturaen ikke kan matches, afvises den, og leverandøren adviseres via e-mail — eller via den kanal, de brugte til at sende fakturaen — og de sender en rettet faktura. Hvis varemodtagelsen mangler, markerer vi det i ERP-systemet og kontakter internt en anden kreditormedarbejder for at få den. Vi kan også ringe til den person, der bestilte varerne, for at høre, om de har modtaget dem, og dermed foretage en manuel varemodtagelse. Vi kan fortsætte uden varemodtagelse, hvis det er nødvendigt. Hvis afvigelsen er mere end 5 %, eller valutakursen er forkert, eller CVR-nummeret er forkert, afvises fakturaen, og leverandøren kontaktes direkte af kreditorbogholder.

Interviewer: Hvad sker der, når tre-vejsmatchen er verificeret?

SME: Når den er verificeret, konteres fakturaen til den relevante finanskonto, omkostningssted eller afdeling. Kreditorbogholder bruger den originale indkøbsordre som reference. Hvis konteringsoplysningerne er uklare, kontaktes den oprindelige rekvirent. Derefter sendes fakturaen gennem et godkendelsesforløb baseret på beløb — routingen sker automatisk via ERP-systemet.

Interviewer: Kan du beskrive godkendelsesgrænser og hvem der er involveret på hvert niveau?

SME: Under 10.000 kr. er det automatisk godkendt. Fakturaer mellem 10.000 og 99.999 kr. sendes til afdelingslederen for godkendelse. Direktøren skal involveres, hvis beløbet er 100.000 kr. eller derover. De autoriserede ledere bekræfter udgiften og sikrer, at den er korrekt kategoriseret.

Interviewer: Hvad sker der efter godkendelse, og hvordan behandles betalingen?

SME: Efter godkendelse bogføres fakturaen automatisk i ERP-systemet som en kreditorpostering — dette opretter en kredit til kreditorer og en debitering til den relevante omkostnings- eller aktivkonto. Betaling sker via bankoverførsel, check, virtuelt betalingskort eller anden metode som angivet i leverandørstamdata. Betalinger udløses på månedlig basis. Ved månedsafslutning sikrer betalingschefen, at alle betalinger sendes til banken, og banken udsender en bekræftelse via e-mail til betalingschefen.

Interviewer: Er der undtagelser eller særtilfælde, vi bør registrere i processen?

SME: Hvis der kommer en fejlbesked fra banken om en mislykket betaling, kontakter betalingsteamet banken og håndterer det som en undtagelse — dette sker fra sag til sag og er meget svært at dokumentere, så vi bør lade det ligge. Tabte fakturaer er også en undtagelse, vi ikke vil håndtere i processen. Leverandører sender altid en rettet faktura, når en afvises. Når betalingen er behandlet, nulstilles kreditorposteringen ved at debitere kreditorer og kreditere bankkontoen.`;

export const DA_DEMO_PARSED = {"process_name":"Behandling af kreditorfakturaer","roles":[{"id":"role_1","name":"Kreditorbogholder"},{"id":"role_2","name":"Afdelingsleder"},{"id":"role_3","name":"Direktør"},{"id":"role_4","name":"Betalingsteam"},{"id":"role_5","name":"Betalingschef"},{"id":"role_6","name":"ERP-system"}],"events":[{"id":"event_1","type":"start","name":"Leverandørfaktura modtaget"},{"id":"event_2","type":"end","name":"Betaling behandlet og kreditorer afstemt"},{"id":"event_3","type":"end","name":"Faktura afvist"}],"activities":[{"id":"act_1","name":"Fakturamodtagelse","performer":"role_1"},{"id":"act_2","name":"Tre-vejsmatch","performer":"role_1"},{"id":"act_3","name":"Håndtering af manglende dokumenter","performer":"role_1"},{"id":"act_4","name":"Afvis ugyldig faktura","performer":"role_1"},{"id":"act_5","name":"Konter faktura","performer":"role_1"},{"id":"act_6","name":"Send til godkendelse","performer":"role_6"},{"id":"act_7","name":"Afdelingsleders godkendelse","performer":"role_2"},{"id":"act_8","name":"Direktørens godkendelse","performer":"role_3"},{"id":"act_9","name":"Bogfør regnskabspost","performer":"role_6"},{"id":"act_10","name":"Behandl månedlige betalinger","performer":"role_4"},{"id":"act_11","name":"Godkend betalingsbatch","performer":"role_5"},{"id":"act_12","name":"Nulstil kreditorer","performer":"role_6"}],"gateways":[{"id":"gw_1","type":"exclusive","name":"Dokumenter tilgængelige?"},{"id":"gw_2","type":"exclusive","name":"Faktura gyldig?"},{"id":"gw_3","type":"exclusive","name":"Godkendelsesbeløbsgrænse"},{"id":"gw_4","type":"exclusive","name":"Direktørgodkendelse nødvendig?"},{"id":"gw_5","type":"exclusive","name":"Godkendt?"}],"sequence_flows":[{"id":"flow_1","from":"event_1","to":"act_1","condition":null},{"id":"flow_2","from":"act_1","to":"act_2","condition":null},{"id":"flow_3","from":"act_2","to":"gw_1","condition":null},{"id":"flow_4","from":"gw_1","to":"act_3","condition":"Manglende dokumenter"},{"id":"flow_5","from":"gw_1","to":"gw_2","condition":"Dokumenter tilgængelige"},{"id":"flow_6","from":"act_3","to":"gw_2","condition":null},{"id":"flow_7","from":"gw_2","to":"act_4","condition":"Ugyldig"},{"id":"flow_8","from":"gw_2","to":"act_5","condition":"Gyldig"},{"id":"flow_9","from":"act_4","to":"event_3","condition":null},{"id":"flow_10","from":"act_5","to":"act_6","condition":null},{"id":"flow_11","from":"act_6","to":"gw_3","condition":null},{"id":"flow_12","from":"gw_3","to":"act_9","condition":"Under 10.000 kr."},{"id":"flow_13","from":"gw_3","to":"act_7","condition":"10.000-99.999 kr."},{"id":"flow_14","from":"gw_3","to":"gw_4","condition":"100.000 kr.+"},{"id":"flow_15","from":"gw_4","to":"act_8","condition":"Direktørgodkendelse nødvendig"},{"id":"flow_16","from":"act_7","to":"gw_5","condition":null},{"id":"flow_17","from":"act_8","to":"gw_5","condition":null},{"id":"flow_18","from":"gw_5","to":"act_9","condition":"Godkendt"},{"id":"flow_19","from":"gw_5","to":"event_3","condition":"Afvist"},{"id":"flow_20","from":"act_9","to":"act_10","condition":null},{"id":"flow_21","from":"act_10","to":"act_11","condition":null},{"id":"flow_22","from":"act_11","to":"act_12","condition":null},{"id":"flow_23","from":"act_12","to":"event_2","condition":null}]};

export const DA_DEMO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
             xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"
             targetNamespace="http://bpmn.io/schema/bpmn">
  <collaboration id="Collaboration_1">
    <participant id="Participant_1" name="Behandling af kreditorfakturaer" processRef="Process_1" />
  </collaboration>
  <process id="Process_1" isExecutable="false">
    <laneSet id="LaneSet_1">
      <lane id="role_1" name="Kreditorbogholder">
        <flowNodeRef>event_1</flowNodeRef><flowNodeRef>event_3</flowNodeRef>
        <flowNodeRef>act_1</flowNodeRef><flowNodeRef>act_2</flowNodeRef>
        <flowNodeRef>act_3</flowNodeRef><flowNodeRef>act_4</flowNodeRef>
        <flowNodeRef>act_5</flowNodeRef><flowNodeRef>gw_1</flowNodeRef><flowNodeRef>gw_2</flowNodeRef>
      </lane>
      <lane id="role_2" name="Afdelingsleder">
        <flowNodeRef>act_7</flowNodeRef><flowNodeRef>gw_5</flowNodeRef>
      </lane>
      <lane id="role_3" name="Direktør">
        <flowNodeRef>act_8</flowNodeRef>
      </lane>
      <lane id="role_4" name="Betalingsteam">
        <flowNodeRef>act_10</flowNodeRef>
      </lane>
      <lane id="role_5" name="Betalingschef">
        <flowNodeRef>act_11</flowNodeRef>
      </lane>
      <lane id="role_6" name="ERP-system">
        <flowNodeRef>event_2</flowNodeRef><flowNodeRef>act_6</flowNodeRef>
        <flowNodeRef>act_9</flowNodeRef><flowNodeRef>act_12</flowNodeRef>
        <flowNodeRef>gw_3</flowNodeRef><flowNodeRef>gw_4</flowNodeRef>
      </lane>
    </laneSet>
    <startEvent id="event_1" name="Leverandørfaktura modtaget" />
    <endEvent id="event_2" name="Betaling behandlet og kreditorer afstemt" />
    <endEvent id="event_3" name="Faktura afvist" />
    <userTask id="act_1" name="Fakturamodtagelse" />
    <userTask id="act_2" name="Tre-vejsmatch" />
    <userTask id="act_3" name="Håndtering af manglende dokumenter" />
    <userTask id="act_4" name="Afvis ugyldig faktura" />
    <userTask id="act_5" name="Konter faktura" />
    <userTask id="act_6" name="Send til godkendelse" />
    <userTask id="act_7" name="Afdelingsleders godkendelse" />
    <userTask id="act_8" name="Direktørens godkendelse" />
    <userTask id="act_9" name="Bogfør regnskabspost" />
    <userTask id="act_10" name="Behandl månedlige betalinger" />
    <userTask id="act_11" name="Godkend betalingsbatch" />
    <userTask id="act_12" name="Nulstil kreditorer" />
    <exclusiveGateway id="gw_1" name="Dokumenter tilgængelige?" />
    <exclusiveGateway id="gw_2" name="Faktura gyldig?" />
    <exclusiveGateway id="gw_3" name="Godkendelsesbeløbsgrænse" />
    <exclusiveGateway id="gw_4" name="Direktørgodkendelse nødvendig?" />
    <exclusiveGateway id="gw_5" name="Godkendt?" />
    <sequenceFlow id="flow_1" sourceRef="event_1" targetRef="act_1" />
    <sequenceFlow id="flow_2" sourceRef="act_1" targetRef="act_2" />
    <sequenceFlow id="flow_3" sourceRef="act_2" targetRef="gw_1" />
    <sequenceFlow id="flow_4" sourceRef="gw_1" targetRef="act_3"><conditionExpression>Manglende dokumenter</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_5" sourceRef="gw_1" targetRef="gw_2"><conditionExpression>Dokumenter tilgængelige</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_6" sourceRef="act_3" targetRef="gw_2" />
    <sequenceFlow id="flow_7" sourceRef="gw_2" targetRef="act_4"><conditionExpression>Ugyldig</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_8" sourceRef="gw_2" targetRef="act_5"><conditionExpression>Gyldig</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_9" sourceRef="act_4" targetRef="event_3" />
    <sequenceFlow id="flow_10" sourceRef="act_5" targetRef="act_6" />
    <sequenceFlow id="flow_11" sourceRef="act_6" targetRef="gw_3" />
    <sequenceFlow id="flow_12" sourceRef="gw_3" targetRef="act_9"><conditionExpression>Under 10.000 kr.</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_13" sourceRef="gw_3" targetRef="act_7"><conditionExpression>10.000-99.999 kr.</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_14" sourceRef="gw_3" targetRef="gw_4"><conditionExpression>100.000 kr.+</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_15" sourceRef="gw_4" targetRef="act_8"><conditionExpression>Direktørgodkendelse nødvendig</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_16" sourceRef="act_7" targetRef="gw_5" />
    <sequenceFlow id="flow_17" sourceRef="act_8" targetRef="gw_5" />
    <sequenceFlow id="flow_18" sourceRef="gw_5" targetRef="act_9"><conditionExpression>Godkendt</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_19" sourceRef="gw_5" targetRef="event_3"><conditionExpression>Afvist</conditionExpression></sequenceFlow>
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

export const DA_DEMO_DESCRIPTION = {"process_name":"Behandling af kreditorfakturaer","overview":"Denne proces håndterer den fulde livscyklus for leverandørfakturabehandling, fra modtagelse til betaling. Den begynder, når virksomheden modtager en leverandørfaktura, og inkluderer verificering via tre-vejsmatch, godkendelsesforløb baseret på beløbsgrænser og månedlig betalingsbehandling. Processen sikrer korrekt validering af fakturaer mod støttedokumenter inden betaling.","scope":"Processen dækker fakturamodtagelse, tre-vejsmatch, kontering til finanskonti, lagdelte godkendelsesforløb og betalingsbehandling. Uden for scope er detaljerede undtagelseshåndteringsprocedurer, specifikke fejlbetalingsprocedurer og tabte fakturaer.","roles":[{"name":"Kreditorbogholder","responsibilities":"Modtager fakturaer, udfører tre-vejsmatch, håndterer afvisninger og kommunikation med leverandører, konterer fakturaer til relevante konti, håndterer undtagelser og kontakter interne rekvirenter ved manglende oplysninger"},{"name":"Afdelingsleder","responsibilities":"Godkender fakturaer over 10.000 kr., bekræfter at udgifter er korrekt kategoriseret, og kan afvise fakturaer der kræver leverandørrettelse"},{"name":"Direktør","responsibilities":"Godkender fakturaer over 100.000 kr., giver endelig autorisation til transaktioner af høj værdi"},{"name":"Betalingsteam","responsibilities":"Behandler månedlige betalinger til leverandører via de betalingsmetoder, der er angivet i leverandørstamdata"},{"name":"Betalingschef","responsibilities":"Gennemgår og godkender betalingsbatcher inden afsendelse til banken, modtager bankbekræftelsesnotifikationer"}],"steps":[{"order":1,"name":"Fakturamodtagelse","performer":"Kreditorbogholder","description":"Virksomheden modtager leverandørfaktura via e-mail, post eller elektronisk faktureringssystem for varer eller tjenesteydelser"},{"order":2,"name":"Tre-vejsmatch","performer":"Kreditorbogholder","description":"Kontrol af fakturaoplysninger mod støttedokumenter inkl. indkøbsordre, varemodtagelse og leveringsbekræftelse for at sikre korrekt bestilling, modtagelse og pris"},{"order":3,"name":"Håndtering af manglende dokumenter","performer":"Kreditorbogholder","description":"Hvis varemodtagelse mangler, markeres det i ERP-systemet, og interne kollegaer eller den oprindelige rekvirent kontaktes for manuel verificering"},{"order":4,"name":"Afvis ugyldig faktura","performer":"Kreditorbogholder","description":"Afvis fakturaer med afvigelser over 5 %, forkert valutakurs eller forkert CVR-nummer, og adviser leverandøren via e-mail med specifikke fejloplysninger"},{"order":5,"name":"Konter faktura","performer":"Kreditorbogholder","description":"Konter verificerede fakturaer til relevante finanskonti, omkostningssteder eller afdelinger med indkøbsordren som reference"},{"order":6,"name":"Send til godkendelse","performer":"ERP-system","description":"Automatisk routing via lagdelt godkendelsesforløb: under 10.000 kr. automatisk godkendt, 10.000+ kr. til afdelingsleder, 100.000+ kr. til direktør"},{"order":7,"name":"Ledelsesgodkendelse","performer":"Afdelingsleder/Direktør","description":"Autoriserede ledere gennemgår og godkender udgifter, bekræfter korrekt kategorisering, eller afviser fakturaer der kræver leverandørrettelse"},{"order":8,"name":"Bogfør regnskabspost","performer":"ERP-system","description":"Efter godkendelse bogføres fakturaen automatisk som en kreditorpostering med kredit til kreditorer og debitering til den relevante konto"},{"order":9,"name":"Behandl månedlige betalinger","performer":"Betalingsteam","description":"Ved månedsafslutning behandles alle godkendte fakturaer til betaling via de metoder, der er angivet i leverandørstamdata"},{"order":10,"name":"Godkend betalingsbatch","performer":"Betalingschef","description":"Gennemgå og godkend betalingsbatch inden afsendelse til banken"},{"order":11,"name":"Nulstil kreditorer","performer":"ERP-system","description":"Efter betalingsbehandling nulstilles kreditorposteringerne ved at debitere kreditorer og kreditere bankkontoen, og bankbekræftelse modtages"}],"exceptions":["Tre-vejsmatch-fejl der kræver leverandørkorrigeret faktura","Manglende støttedokumenter der kræver manuel verificering","Ledelsesgodkendelse der afviser fakturaer","Mislykkede bankbetalinger der kræver manuel intervention","Tabte fakturaer som leverandøren ikke retter"],"known_issues":["Betalingsfejl kræver manuel intervention og bankkontakt","Manuel varemodtagelsesverificering når systemkvitteringer mangler","Kompleks undtagelseshåndtering for diverse fakturauoverensstemmelser"]};

export const DA_DEMO_IMPROVEMENTS = [
  { id: 'imp_1', title: 'Implementér OCR og AI-drevet fakturaindlæsning', category: 'automation', effort: 'high', effort_score: 80, impact_score: 85, ai_candidate: true, description: 'Anvend optisk tegnlæsning (OCR) og maskinlæring til automatisk at udtrække fakturaoplysninger, hvilket reducerer manuel dataindtastning og forbedrer nøjagtigheden ved fakturamodtagelse og kontering', benefit: 'Reducerer behandlingstiden med 60-70 %, eliminerer dataindtastningsfejl og frigiver kreditorbogholdere til mere værdifulde opgaver' },
  { id: 'imp_2', title: 'Etablér realtids fakturastatus-dashboard', category: 'clarity', effort: 'medium', effort_score: 45, impact_score: 70, ai_candidate: false, description: 'Opret et centralt dashboard der viser fakturastatus, godkendelsesbundne og aldersfordeling, synligt for alle interessenter i processen', benefit: 'Forbedrer overblikket, reducerer statusforespørgsler og muliggør proaktiv styring af betalingsfrister og likviditet' },
  { id: 'imp_3', title: 'Automatisér tre-vejsmatch-processen', category: 'automation', effort: 'medium', effort_score: 55, impact_score: 75, ai_candidate: true, description: 'Implementér automatisk match af fakturaer med indkøbsordrer og varemodtagelser via ERP-systemets funktionalitet med undtagelsesbaseret behandling', benefit: 'Reducerer manuel matchtid med 80 %, forbedrer nøjagtighed og muliggør direkte behandling af eksakte match' },
  { id: 'imp_4', title: 'Implementér dynamiske godkendelsesforløb', category: 'governance', effort: 'medium', effort_score: 50, impact_score: 65, ai_candidate: false, description: 'Opret konfigurerbar godkendelsesrouting baseret på leverandør, kategori, afdeling og beløb med automatisk eskalering ved forsinkede godkendelser', benefit: 'Reducerer godkendelsescyklustid, sikrer korrekte autorisationskontroller og minimerer flaskehalse ved fraværende godkendere' },
  { id: 'imp_5', title: 'Optimér betalingsfrekvensen', category: 'efficiency', effort: 'low', effort_score: 25, impact_score: 60, ai_candidate: false, description: 'Skift fra månedlige til ugentlige betalingskørsler med automatisk betalingsplanlægning baseret på betalingsbetingelser og rabatter ved tidlig betaling', benefit: 'Forbedrer leverandørrelationer, udnytter early payment-rabatter og optimerer likviditetsstyringen' },
  { id: 'imp_6', title: 'Etablér leverandørportal til selvbetjening', category: 'efficiency', effort: 'high', effort_score: 75, impact_score: 70, ai_candidate: false, description: 'Indfør en leverandørportal der giver leverandører mulighed for at indsende fakturaer elektronisk og følge betalingsstatus', benefit: 'Reducerer manuel fakturabehandling, forbedrer leverandørtilfredsheden og sænker antallet af statushenvendelser med 40-50 %' },
  { id: 'imp_7', title: 'Implementér undtagelsesbaserede proceskontroller', category: 'risk', effort: 'medium', effort_score: 45, impact_score: 65, ai_candidate: true, description: 'Definer klare tolerancegrænser for fakturauoverensstemmelser og automatisér behandling af fakturaer inden for acceptable grænser, mens undtagelser markeres til gennemgang', benefit: 'Reducerer behandlingstid for rutinefakturaer og opretholder kontrol over undtagelser og potentiel svindel' },
];

export const DA_DEMO_SELECTED_IDS = ['imp_2', 'imp_1', 'imp_3', 'imp_5', 'imp_6'];

export const DA_DEMO_TO_BE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
             xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"
             targetNamespace="http://bpmn.io/schema/bpmn">
  <collaboration id="Collaboration_1">
    <participant id="Participant_1" name="Behandling af kreditorfakturaer — TO-BE" processRef="Process_1" />
  </collaboration>
  <process id="Process_1" isExecutable="false">
    <laneSet id="LaneSet_1">
      <lane id="role_1" name="Kreditorbogholder">
        <flowNodeRef>act_3</flowNodeRef>
        <flowNodeRef>act_4</flowNodeRef>
        <flowNodeRef>act_15</flowNodeRef>
        <flowNodeRef>gw_1</flowNodeRef>
        <flowNodeRef>gw_2</flowNodeRef>
      </lane>
      <lane id="role_2" name="Afdelingsleder">
        <flowNodeRef>act_7</flowNodeRef>
        <flowNodeRef>gw_5</flowNodeRef>
      </lane>
      <lane id="role_3" name="Direktør">
        <flowNodeRef>act_8</flowNodeRef>
      </lane>
      <lane id="role_4" name="Betalingsteam">
        <flowNodeRef>act_10</flowNodeRef>
      </lane>
      <lane id="role_5" name="Betalingschef">
        <flowNodeRef>act_11</flowNodeRef>
      </lane>
      <lane id="role_6" name="ERP-system">
        <flowNodeRef>event_2</flowNodeRef>
        <flowNodeRef>act_2</flowNodeRef>
        <flowNodeRef>act_6</flowNodeRef>
        <flowNodeRef>act_9</flowNodeRef>
        <flowNodeRef>act_12</flowNodeRef>
        <flowNodeRef>gw_6</flowNodeRef>
      </lane>
      <lane id="role_7" name="OCR-system">
        <flowNodeRef>event_1</flowNodeRef>
        <flowNodeRef>act_1</flowNodeRef>
        <flowNodeRef>act_5</flowNodeRef>
      </lane>
      <lane id="role_8" name="Leverandørportal">
        <flowNodeRef>event_3</flowNodeRef>
        <flowNodeRef>act_14</flowNodeRef>
      </lane>
      <lane id="role_9" name="Fakturastatus-dashboard">
        <flowNodeRef>act_13</flowNodeRef>
        <flowNodeRef>gw_3</flowNodeRef>
        <flowNodeRef>gw_4</flowNodeRef>
      </lane>
    </laneSet>
    <startEvent id="event_1" name="Leverandørfaktura modtaget" />
    <endEvent id="event_2" name="Betaling behandlet og kreditorer afstemt" />
    <endEvent id="event_3" name="Faktura afvist" />
    <userTask id="act_1" name="Automatisk fakturaindlæsning" />
    <userTask id="act_2" name="Automatisk tre-vejsmatch" />
    <userTask id="act_3" name="Håndtering af manglende dokumenter" />
    <userTask id="act_4" name="Afvis ugyldig faktura" />
    <userTask id="act_5" name="AI-assisteret kontering" />
    <userTask id="act_6" name="Send til godkendelse" />
    <userTask id="act_7" name="Afdelingsleders godkendelse" />
    <userTask id="act_8" name="Direktørens godkendelse" />
    <userTask id="act_9" name="Bogfør regnskabspost" />
    <userTask id="act_10" name="Behandl ugentlige betalinger" />
    <userTask id="act_11" name="Godkend betalingsbatch" />
    <userTask id="act_12" name="Nulstil kreditorer" />
    <userTask id="act_13" name="Opdater fakturastatus-dashboard" />
    <userTask id="act_14" name="Opdater leverandørportalstatus" />
    <userTask id="act_15" name="Gennemgå undtagelsesrapport" />
    <exclusiveGateway id="gw_1" name="Dokumenter tilgængelige?" />
    <exclusiveGateway id="gw_2" name="Faktura gyldig?" />
    <exclusiveGateway id="gw_3" name="Godkendelsesbeløbsgrænse" />
    <exclusiveGateway id="gw_4" name="Direktørgodkendelse nødvendig?" />
    <exclusiveGateway id="gw_5" name="Godkendt?" />
    <exclusiveGateway id="gw_6" name="Match vellykket?" />
    <sequenceFlow id="flow_1" sourceRef="event_1" targetRef="act_1"></sequenceFlow>
    <sequenceFlow id="flow_2" sourceRef="act_1" targetRef="act_2"></sequenceFlow>
    <sequenceFlow id="flow_3" sourceRef="act_2" targetRef="gw_6"></sequenceFlow>
    <sequenceFlow id="flow_4" sourceRef="gw_6" targetRef="act_15"><conditionExpression>Undtagelser fundet</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_5" sourceRef="gw_6" targetRef="gw_1"><conditionExpression>Match vellykket</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_6" sourceRef="act_15" targetRef="gw_1"></sequenceFlow>
    <sequenceFlow id="flow_7" sourceRef="gw_1" targetRef="act_3"><conditionExpression>Manglende dokumenter</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_8" sourceRef="gw_1" targetRef="gw_2"><conditionExpression>Dokumenter tilgængelige</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_9" sourceRef="act_3" targetRef="gw_2"></sequenceFlow>
    <sequenceFlow id="flow_10" sourceRef="gw_2" targetRef="act_4"><conditionExpression>Ugyldig</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_11" sourceRef="gw_2" targetRef="act_5"><conditionExpression>Gyldig</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_12" sourceRef="act_4" targetRef="act_14"></sequenceFlow>
    <sequenceFlow id="flow_13" sourceRef="act_14" targetRef="event_3"></sequenceFlow>
    <sequenceFlow id="flow_14" sourceRef="act_5" targetRef="act_6"></sequenceFlow>
    <sequenceFlow id="flow_15" sourceRef="act_6" targetRef="act_13"></sequenceFlow>
    <sequenceFlow id="flow_16" sourceRef="act_13" targetRef="gw_3"></sequenceFlow>
    <sequenceFlow id="flow_17" sourceRef="gw_3" targetRef="act_9"><conditionExpression>Under 10.000 kr.</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_18" sourceRef="gw_3" targetRef="act_7"><conditionExpression>10.000-99.999 kr.</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_19" sourceRef="gw_3" targetRef="gw_4"><conditionExpression>100.000 kr.+</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_20" sourceRef="gw_4" targetRef="act_8"><conditionExpression>Direktørgodkendelse nødvendig</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_21" sourceRef="act_7" targetRef="gw_5"></sequenceFlow>
    <sequenceFlow id="flow_22" sourceRef="act_8" targetRef="gw_5"></sequenceFlow>
    <sequenceFlow id="flow_23" sourceRef="gw_5" targetRef="act_9"><conditionExpression>Godkendt</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_24" sourceRef="gw_5" targetRef="act_14"><conditionExpression>Afvist</conditionExpression></sequenceFlow>
    <sequenceFlow id="flow_25" sourceRef="act_9" targetRef="act_10"></sequenceFlow>
    <sequenceFlow id="flow_26" sourceRef="act_10" targetRef="act_11"></sequenceFlow>
    <sequenceFlow id="flow_27" sourceRef="act_11" targetRef="act_12"></sequenceFlow>
    <sequenceFlow id="flow_28" sourceRef="act_12" targetRef="event_2"></sequenceFlow>
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true"><dc:Bounds x="100" y="80" width="3660" height="1800" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_1_di" bpmnElement="role_1" isHorizontal="true"><dc:Bounds x="130" y="80" width="3630" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_2_di" bpmnElement="role_2" isHorizontal="true"><dc:Bounds x="130" y="280" width="3630" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_3_di" bpmnElement="role_3" isHorizontal="true"><dc:Bounds x="130" y="480" width="3630" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_4_di" bpmnElement="role_4" isHorizontal="true"><dc:Bounds x="130" y="680" width="3630" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_5_di" bpmnElement="role_5" isHorizontal="true"><dc:Bounds x="130" y="880" width="3630" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_6_di" bpmnElement="role_6" isHorizontal="true"><dc:Bounds x="130" y="1080" width="3630" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_7_di" bpmnElement="role_7" isHorizontal="true"><dc:Bounds x="130" y="1280" width="3630" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_8_di" bpmnElement="role_8" isHorizontal="true"><dc:Bounds x="130" y="1480" width="3630" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="role_9_di" bpmnElement="role_9" isHorizontal="true"><dc:Bounds x="130" y="1680" width="3630" height="200" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="event_1_di" bpmnElement="event_1"><dc:Bounds x="302" y="1362" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="event_2_di" bpmnElement="event_2"><dc:Bounds x="3502" y="1162" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="event_3_di" bpmnElement="event_3"><dc:Bounds x="2302" y="1562" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_1_di" bpmnElement="act_1"><dc:Bounds x="470" y="1340" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_2_di" bpmnElement="act_2"><dc:Bounds x="670" y="1140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_3_di" bpmnElement="act_3"><dc:Bounds x="1470" y="140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_4_di" bpmnElement="act_4"><dc:Bounds x="1870" y="140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_5_di" bpmnElement="act_5"><dc:Bounds x="1870" y="1340" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_6_di" bpmnElement="act_6"><dc:Bounds x="2070" y="1140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_7_di" bpmnElement="act_7"><dc:Bounds x="2670" y="340" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_8_di" bpmnElement="act_8"><dc:Bounds x="2870" y="540" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_9_di" bpmnElement="act_9"><dc:Bounds x="3070" y="1140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_10_di" bpmnElement="act_10"><dc:Bounds x="2870" y="740" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_11_di" bpmnElement="act_11"><dc:Bounds x="3070" y="940" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_12_di" bpmnElement="act_12"><dc:Bounds x="3270" y="1140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_13_di" bpmnElement="act_13"><dc:Bounds x="2270" y="1740" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_14_di" bpmnElement="act_14"><dc:Bounds x="3070" y="1540" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="act_15_di" bpmnElement="act_15"><dc:Bounds x="1070" y="140" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw_1_di" bpmnElement="gw_1"><dc:Bounds x="1295" y="155" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw_2_di" bpmnElement="gw_2"><dc:Bounds x="1695" y="155" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw_3_di" bpmnElement="gw_3"><dc:Bounds x="2495" y="1755" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw_4_di" bpmnElement="gw_4"><dc:Bounds x="2695" y="1755" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw_5_di" bpmnElement="gw_5"><dc:Bounds x="3095" y="355" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gw_6_di" bpmnElement="gw_6"><dc:Bounds x="895" y="1155" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow_1_di" bpmnElement="flow_1"><di:waypoint x="338" y="1380" /><di:waypoint x="470" y="1380" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_2_di" bpmnElement="flow_2"><di:waypoint x="570" y="1380" /><di:waypoint x="620" y="1380" /><di:waypoint x="620" y="1180" /><di:waypoint x="670" y="1180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_3_di" bpmnElement="flow_3"><di:waypoint x="770" y="1180" /><di:waypoint x="895" y="1180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_4_di" bpmnElement="flow_4"><di:waypoint x="945" y="1180" /><di:waypoint x="1008" y="1180" /><di:waypoint x="1008" y="180" /><di:waypoint x="1070" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_5_di" bpmnElement="flow_5"><di:waypoint x="945" y="1180" /><di:waypoint x="1120" y="1180" /><di:waypoint x="1120" y="180" /><di:waypoint x="1295" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_6_di" bpmnElement="flow_6"><di:waypoint x="1170" y="180" /><di:waypoint x="1295" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_7_di" bpmnElement="flow_7"><di:waypoint x="1345" y="180" /><di:waypoint x="1470" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_8_di" bpmnElement="flow_8"><di:waypoint x="1345" y="180" /><di:waypoint x="1695" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_9_di" bpmnElement="flow_9"><di:waypoint x="1570" y="180" /><di:waypoint x="1695" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_10_di" bpmnElement="flow_10"><di:waypoint x="1745" y="180" /><di:waypoint x="1870" y="180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_11_di" bpmnElement="flow_11"><di:waypoint x="1745" y="180" /><di:waypoint x="1808" y="180" /><di:waypoint x="1808" y="1380" /><di:waypoint x="1870" y="1380" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_12_di" bpmnElement="flow_12"><di:waypoint x="1970" y="180" /><di:waypoint x="2520" y="180" /><di:waypoint x="2520" y="1580" /><di:waypoint x="3070" y="1580" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_13_di" bpmnElement="flow_13"><di:waypoint x="3170" y="1580" /><di:waypoint x="2302" y="1580" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_14_di" bpmnElement="flow_14"><di:waypoint x="1970" y="1380" /><di:waypoint x="2020" y="1380" /><di:waypoint x="2020" y="1180" /><di:waypoint x="2070" y="1180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_15_di" bpmnElement="flow_15"><di:waypoint x="2170" y="1180" /><di:waypoint x="2220" y="1180" /><di:waypoint x="2220" y="1780" /><di:waypoint x="2270" y="1780" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_16_di" bpmnElement="flow_16"><di:waypoint x="2370" y="1780" /><di:waypoint x="2495" y="1780" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_17_di" bpmnElement="flow_17"><di:waypoint x="2545" y="1780" /><di:waypoint x="2808" y="1780" /><di:waypoint x="2808" y="1180" /><di:waypoint x="3070" y="1180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_18_di" bpmnElement="flow_18"><di:waypoint x="2545" y="1780" /><di:waypoint x="2608" y="1780" /><di:waypoint x="2608" y="380" /><di:waypoint x="2670" y="380" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_19_di" bpmnElement="flow_19"><di:waypoint x="2545" y="1780" /><di:waypoint x="2695" y="1780" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_20_di" bpmnElement="flow_20"><di:waypoint x="2745" y="1780" /><di:waypoint x="2808" y="1780" /><di:waypoint x="2808" y="580" /><di:waypoint x="2870" y="580" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_21_di" bpmnElement="flow_21"><di:waypoint x="2770" y="380" /><di:waypoint x="3095" y="380" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_22_di" bpmnElement="flow_22"><di:waypoint x="2970" y="580" /><di:waypoint x="3033" y="580" /><di:waypoint x="3033" y="380" /><di:waypoint x="3095" y="380" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_23_di" bpmnElement="flow_23"><di:waypoint x="3145" y="380" /><di:waypoint x="3108" y="380" /><di:waypoint x="3108" y="1180" /><di:waypoint x="3070" y="1180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_24_di" bpmnElement="flow_24"><di:waypoint x="3145" y="380" /><di:waypoint x="3108" y="380" /><di:waypoint x="3108" y="1580" /><di:waypoint x="3070" y="1580" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_25_di" bpmnElement="flow_25"><di:waypoint x="3170" y="1180" /><di:waypoint x="3020" y="1180" /><di:waypoint x="3020" y="780" /><di:waypoint x="2870" y="780" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_26_di" bpmnElement="flow_26"><di:waypoint x="2970" y="780" /><di:waypoint x="3020" y="780" /><di:waypoint x="3020" y="980" /><di:waypoint x="3070" y="980" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_27_di" bpmnElement="flow_27"><di:waypoint x="3170" y="980" /><di:waypoint x="3220" y="980" /><di:waypoint x="3220" y="1180" /><di:waypoint x="3270" y="1180" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow_28_di" bpmnElement="flow_28"><di:waypoint x="3370" y="1180" /><di:waypoint x="3502" y="1180" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

export const DA_DEMO_PROJECT_PLAN = {"plan_name":"Transformation af kreditorfaktureringsprocessen","duration_weeks":14,"tracks":[{"id":"track_1","name":"Teknologi og automatisering"},{"id":"track_2","name":"Procesoptimering"},{"id":"track_3","name":"Leverandørhåndtering"},{"id":"track_4","name":"Overvågning og styring"}],"tasks":[{"id":"task_1","title":"Gennemfør leverandørevaluering og -valg af OCR/AI-løsning","track_id":"track_1","week_start":1,"week_end":3,"owner":"IT-chef","improvement_id":"imp_1"},{"id":"task_2","title":"Design og konfigurér OCR-dataindlæsningsforløb","track_id":"track_1","week_start":4,"week_end":7,"owner":"Teknisk projektleder","improvement_id":"imp_1"},{"id":"task_3","title":"Indfør OCR-system og gennemfør brugeraccepttest","track_id":"track_1","week_start":8,"week_end":10,"owner":"Implementeringsteam","improvement_id":"imp_1"},{"id":"task_4","title":"Konfigurér ERP-system til automatisk tre-vejsmatch","track_id":"track_1","week_start":2,"week_end":5,"owner":"ERP-administrator","improvement_id":"imp_3"},{"id":"task_5","title":"Test automatiske matchregler og undtagelseshåndtering","track_id":"track_1","week_start":6,"week_end":8,"owner":"Kreditorfagansvarlig","improvement_id":"imp_3"},{"id":"task_6","title":"Analysér nuværende betalingscyklusser og rabatmuligheder","track_id":"track_2","week_start":1,"week_end":2,"owner":"Kreditorchef","improvement_id":"imp_5"},{"id":"task_7","title":"Redesign betalingsplanlægning og godkendelsesforløb","track_id":"track_2","week_start":3,"week_end":5,"owner":"Procesanalytiker","improvement_id":"imp_5"},{"id":"task_8","title":"Implementér ugentlige betalingskørsler med automatisk planlægning","track_id":"track_2","week_start":6,"week_end":8,"owner":"Betalingsteamleder","improvement_id":"imp_5"},{"id":"task_9","title":"Evaluer og vælg leverandørportalplatform","track_id":"track_3","week_start":1,"week_end":3,"owner":"Leverandørrelationsansvarlig","improvement_id":"imp_6"},{"id":"task_10","title":"Konfigurér leverandørportal og ERP-integration","track_id":"track_3","week_start":4,"week_end":8,"owner":"IT-løsningsarkitekt","improvement_id":"imp_6"},{"id":"task_11","title":"Onboard prioriterede leverandører til selvbetjeningsportal","track_id":"track_3","week_start":9,"week_end":12,"owner":"Leverandøronboarding-team","improvement_id":"imp_6"},{"id":"task_12","title":"Design krav og mockups til realtids-dashboard","track_id":"track_4","week_start":2,"week_end":4,"owner":"Forretningsanalytiker","improvement_id":"imp_2"},{"id":"task_13","title":"Udvikl og indfør fakturastatus-dashboard","track_id":"track_4","week_start":5,"week_end":9,"owner":"Dashboard-udvikler","improvement_id":"imp_2"},{"id":"task_14","title":"Oplær alle interessenter i nye systemer og processer","track_id":"track_4","week_start":10,"week_end":12,"owner":"Kursuskoordinator","improvement_id":"imp_1"},{"id":"task_15","title":"Overvåg performance og optimér systemkonfiguration","track_id":"track_4","week_start":13,"week_end":14,"owner":"Procesexcellence-team","improvement_id":"imp_2"}],"risks":[{"id":"risk_1","title":"OCR-nøjagtighedsproblemer med ikke-standardiserede fakturaformater","probability":70,"consequence":60,"mitigation":"Gennemfør omfattende test med diverse fakturaer og etablér manuelle gennemgangsprocesser for lav-tillids-udtræk"},{"id":"risk_2","title":"Kompleksitet ved ERP-systemintegration","probability":60,"consequence":75,"mitigation":"Inddrag ERP-leverandørens support tidligt og gennemfør en faseopdelt udrulning med parallel behandling i starten"},{"id":"risk_3","title":"Leverandørmodstand mod selvbetjeningsportal","probability":65,"consequence":50,"mitigation":"Udvikl incitamentsprogrammer for leverandører og tilbyd dedikeret support i overgangsperioden"},{"id":"risk_4","title":"Medarbejdermodstand mod automatiserede processer","probability":55,"consequence":65,"mitigation":"Implementér et omfattende forandringsledelsesprogram med omskoling til mere værdifulde opgaver"},{"id":"risk_5","title":"Dashboard-performanceproblemer ved store datamængder","probability":45,"consequence":40,"mitigation":"Implementér datalagringstrategier og optimér databaseforespørgsler i udviklingsfasen"}]};

export const DA_DEMO_AS_IS_METRICS = {
  activities: [
    { id: "act_1",  duration_value: 15, duration_unit: "min", backlog: 50  },
    { id: "act_2",  duration_value: 45, duration_unit: "min", backlog: 120 },
    { id: "act_3",  duration_value: 2,  duration_unit: "hr",  backlog: 30  },
    { id: "act_4",  duration_value: 30, duration_unit: "min", backlog: 15  },
    { id: "act_5",  duration_value: 20, duration_unit: "min", backlog: 80  },
    { id: "act_6",  duration_value: 5,  duration_unit: "min", backlog: 200 },
    { id: "act_7",  duration_value: 1,  duration_unit: "day", backlog: 85  },
    { id: "act_8",  duration_value: 2,  duration_unit: "day", backlog: 10  },
    { id: "act_9",  duration_value: 10, duration_unit: "min", backlog: 200 },
    { id: "act_10", duration_value: 4,  duration_unit: "hr",  backlog: 500 },
    { id: "act_11", duration_value: 2,  duration_unit: "hr",  backlog: 500 },
    { id: "act_12", duration_value: 15, duration_unit: "min", backlog: 200 },
  ],
  gateways: [
    { id: "gw_1", branches: [
      { condition: "Manglende dokumenter", rate: 25 },
      { condition: "Dokumenter tilgængelige", rate: 75 },
    ]},
    { id: "gw_2", branches: [
      { condition: "Ugyldig", rate: 20 },
      { condition: "Gyldig", rate: 80 },
    ]},
    { id: "gw_3", branches: [
      { condition: "Under 10.000 kr.", rate: 60 },
      { condition: "10.000-99.999 kr.", rate: 35 },
      { condition: "100.000 kr.+", rate: 5 },
    ]},
    { id: "gw_4", branches: [
      { condition: "Direktørgodkendelse nødvendig", rate: 100 },
    ]},
    { id: "gw_5", branches: [
      { condition: "Godkendt", rate: 85 },
      { condition: "Afvist", rate: 15 },
    ]},
  ],
};

export const DA_DEMO_TO_BE_METRICS = {
  activities: [
    { id: "act_1",  duration_value: 5,  duration_unit: "min", backlog: 20  },
    { id: "act_2",  duration_value: 5,  duration_unit: "min", backlog: 30  },
    { id: "act_3",  duration_value: 1,  duration_unit: "hr",  backlog: 8   },
    { id: "act_4",  duration_value: 10, duration_unit: "min", backlog: 5   },
    { id: "act_5",  duration_value: 5,  duration_unit: "min", backlog: 20  },
    { id: "act_6",  duration_value: 1,  duration_unit: "min", backlog: 50  },
    { id: "act_7",  duration_value: 4,  duration_unit: "hr",  backlog: 30  },
    { id: "act_8",  duration_value: 4,  duration_unit: "hr",  backlog: 3   },
    { id: "act_9",  duration_value: 1,  duration_unit: "min", backlog: 50  },
    { id: "act_10", duration_value: 30, duration_unit: "min", backlog: 100 },
    { id: "act_11", duration_value: 30, duration_unit: "min", backlog: 100 },
    { id: "act_12", duration_value: 2,  duration_unit: "min", backlog: 50  },
  ],
  gateways: [
    { id: "gw_1", branches: [
      { condition: "Manglende dokumenter", rate: 10 },
      { condition: "Dokumenter tilgængelige", rate: 90 },
    ]},
    { id: "gw_2", branches: [
      { condition: "Ugyldig", rate: 8 },
      { condition: "Gyldig", rate: 92 },
    ]},
    { id: "gw_3", branches: [
      { condition: "Under 10.000 kr.", rate: 60 },
      { condition: "10.000-99.999 kr.", rate: 35 },
      { condition: "100.000 kr.+", rate: 5 },
    ]},
    { id: "gw_4", branches: [
      { condition: "Direktørgodkendelse nødvendig", rate: 100 },
    ]},
    { id: "gw_5", branches: [
      { condition: "Godkendt", rate: 92 },
      { condition: "Afvist", rate: 8 },
    ]},
  ],
};
