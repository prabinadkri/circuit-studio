/*
    Copyright (C) Paul Falstad and Iain Sharp

    This file is part of CircuitJS1.

    CircuitJS1 is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    CircuitJS1 is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with CircuitJS1.  If not, see <http://www.gnu.org/licenses/>.
*/

import { CircuitElm } from "./CircuitElm";
import { CircuitNode } from "./CircuitNode";
import { RailElm } from "./RailElm";
import { VoltageElm } from "./VoltageElm";
import { CircuitXMLSerializer } from "./CircuitXMLSerializer";
import { CircuitXMLDeserializer } from "./CircuitXMLDeserializer";
import { CustomLogicModel } from "./CustomLogicModel";
import { EditInfo } from "./EditInfo";
import { Graphics } from "./Graphics";
import { Locale } from "./Locale";
import { StringTokenizer } from "./StringTokenizer";

export class ExtVoltageElm extends RailElm {
    name: string;
    voltage: number = 0;
    digitalState: string | null = null;
    digitalSupply: number = 5;
    setDigitalDrive(state: string | null, supply = 5): boolean {
        if (state !== null && !['0','1','Z','H','L'].includes(state)) throw Error('Invalid digital drive');
        if (!Number.isFinite(supply) || supply <= 0 || supply > 24) throw Error('Invalid digital supply');
        const changed = (this.digitalState === null) !== (state === null);
        this.digitalState = state; this.digitalSupply = supply;
        if (changed) this.allocNodes();
        return changed;
    }
    getInternalNodeCount(): number { return this.digitalState === null || this.digitalState === undefined ? super.getInternalNodeCount() : 1; }
    nonLinear(): boolean { return this.digitalState !== null && this.digitalState !== undefined; }
    setVoltageSource(n: number, source: any): void {
        if (this.digitalState === null) { super.setVoltageSource(n, source); return; }
        this.voltSource = source; source.setNodes(CircuitNode.ground, this.nodes[1]);
    }
    stamp(): void {
        if (this.digitalState === null) { super.stamp(); return; }
        CircuitElm.sim.stampVoltageSource(CircuitNode.ground, this.nodes[1], this.voltSource);
        CircuitElm.sim.stampNonLinear(this.nodes[0]); CircuitElm.sim.stampNonLinear(this.nodes[1]);
    }
    doStep(): void {
        if (this.digitalState === null) { super.doStep(); return; }
        const r = this.digitalState === 'Z' ? 1e12 : ['H','L'].includes(this.digitalState) ? 30000 : 30;
        const v = ['1','H'].includes(this.digitalState) ? this.digitalSupply : 0;
        CircuitElm.sim.stampResistor(this.nodes[0], this.nodes[1], r);
        CircuitElm.sim.updateVoltageSource(CircuitNode.ground, this.nodes[1], this.voltSource, v);
    }
    validate(): boolean { return this.digitalState === null ? super.validate() : true; }
    getMatrixConnection(a: number, b: number): boolean {
        return this.digitalState === null ? super.getMatrixConnection(a,b) : a !== b;
    }

    constructor(xx: number, yy: number);
    constructor(xa: number, ya: number, xb: number, yb: number, f: number, st: StringTokenizer);
    constructor(xa: number, ya: number, xb?: number, yb?: number, f?: number, st?: StringTokenizer) {
        if (st !== undefined) {
            super(xa, ya, xb!, yb!, f!, st);
            this.name = CustomLogicModel.unescape(st.nextToken());
            this.waveform = VoltageElm.WF_AC;
        } else {
            super(xa, ya, VoltageElm.WF_AC);
            this.name = "ext";
        }
    }

    dumpXml(doc: Document, elem: Element): void {
        super.dumpXml(doc, elem);
        CircuitXMLSerializer.dumpAttr(elem, "nm", this.name);
    }

    undumpXml(xml: CircuitXMLDeserializer): void {
        super.undumpXml(xml);
        this.name = xml.parseStringAttr("nm", this.name) ?? this.name;
    }

    drawRail(g: Graphics): void {
        this.drawRailText(g, this.name);
    }

    setVoltage(v: number): void { if (!isNaN(v)) this.voltage = v; }
    getName(): string { return this.name; }

    getVoltage(): number {
        return this.voltage;
    }

    getDumpType(): number { return 418; }
    getShortcut(): number { return 0; }

    getEditInfo(n: number): EditInfo | null {
        if (n === 0) {
            const ei = new EditInfo("Name", 0, -1, -1);
            ei.text = this.name;
            return ei;
        }
        return null;
    }

    setEditValue(n: number, ei: EditInfo): void {
        if (n === 0)
            this.name = ei.textf!.value;
    }

    isExtVoltageElm(): boolean { return true; }
    getElmType(): string { return "ext. voltage"; }

    getInfo(arr: string[]): void {
        super.getInfo(arr);
        arr[0] = Locale.LS("ext. voltage") + " (" + this.name + ")";
    }
}
