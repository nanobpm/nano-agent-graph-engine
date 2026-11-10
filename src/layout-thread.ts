// Lays out one BPMN diagram with bpmn-auto-layout 2 (the detailed router) off the main
// thread, so a big flow can't stall the engine. See layout.ts.
import { parentPort, workerData } from "node:worker_threads";
import { layoutBpmn } from "@nanobpm/workflow";

const xml = await layoutBpmn(workerData.xml as string);
parentPort!.postMessage(xml);
