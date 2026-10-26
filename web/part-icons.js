// Original schematic palette artwork. GPL-2.0-or-later.
// These are tool icons, not physical package or manufacturer pinout drawings.
const paths = {
 WireElm: 'M3 12H37 M3 10V14 M37 10V14',
 ResistorElm: 'M2 12H9 L12 6 16 18 20 6 24 18 28 6 31 12H38',
 CapacitorElm: 'M2 12H17 M17 4V20 M23 4V20 M23 12H38',
 InductorElm: 'M2 14H7 C7 2 15 2 15 14 C15 2 23 2 23 14 C23 2 31 2 31 14H38',
 DCVoltageElm: 'M20 1V4 M20 20V23 M20 4A8 8 0 1 0 20 20A8 8 0 1 0 20 4 M17 9H23 M20 6V12 M17 16H23',
 GroundElm: 'M20 2V11 M8 11H32 M12 16H28 M17 21H23',
 DiodeElm: 'M2 12H12 M12 4L27 12 12 20Z M27 4V20 M27 12H38',
 LEDElm: 'M2 15H11 M11 8L23 15 11 22Z M23 8V22 M23 15H37 M24 6L29 1 M26 1H29V4 M30 9L35 4 M32 4H35V7',
 SwitchElm: 'M2 16H12 M12 16L28 5 M29 16H38 M11 14V18 M29 14V18',
 NTransistorElm: 'M2 12H15 M15 4V20 M15 10L29 3V1 M15 14L29 21V23 M23 20L29 21 27 15',
 OpAmpElm: 'M11 2L31 12 11 22Z M2 7H11 M2 17H11 M31 12H38 M14 7H18 M14 17H18 M16 15V19',
 TimerElm: 'M10 3H30V21H10Z M3 7H10 M3 12H10 M3 17H10 M30 7H37 M30 12H37 M30 17H37 M15 16V8H20V16H25V8',
 LogicInputElm: 'M3 4H24V20H3Z M24 12H38 M8 15V9H13V15H18V9',
 AndGateElm: 'M12 3H21A9 9 0 0 1 21 21H12Z M2 7H12 M2 17H12 M30 12H38',
 OrGateElm: 'M10 3Q17 12 10 21 Q26 23 32 12 Q26 1 10 3Z M2 7H12 M2 17H12 M32 12H38',
 InverterElm: 'M10 3L28 12 10 21Z M2 12H10 M31 9A3 3 0 1 0 31 15A3 3 0 1 0 31 9 M34 12H38',
 OutputElm: 'M2 12H11 M20 3A9 9 0 1 0 20 21A9 9 0 1 0 20 3 M15 8L20 17 25 8',
 ExtVoltageElm: 'M2 12H10 M10 4H28L36 12 28 20H10Z M14 15V9H20V15H26V9',
 LabeledNodeElm: 'M2 12H10 M10 4H28L36 12 28 20H10Z M16 16V8L24 16V8',
};
export function partIcon(type) {
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 40 24');
 svg.setAttribute('aria-hidden','true');
 svg.setAttribute('focusable','false');
 const path=document.createElementNS(svg.namespaceURI,'path');
 path.setAttribute('d',paths[type]);
 svg.append(path);
 return svg;
}
