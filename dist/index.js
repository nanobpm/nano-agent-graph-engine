import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// src/index.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { spawn } from "node:child_process";
import path from "node:path";

// node_modules/@nanobpm/workflow/dist/xml.js
function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
var NCNAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
function assertIdent(kind, value) {
  if (!NCNAME.test(value)) {
    throw new Error(`${kind} "${value}" is not a valid BPMN identifier (expected an NCName)`);
  }
}
var JOB_TYPE = /^[A-Za-z0-9_][A-Za-z0-9_.:+-]*$/;
function assertJobType(kind, value) {
  if (typeof value !== "string" || !JOB_TYPE.test(value)) {
    throw new Error(`${kind} "${value}" is not a valid job type (expected a non-empty token of letters, digits, and _ . : + -)`);
  }
}
var ISO_DURATION = /^P(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/;
function isIsoDuration(v) {
  if (!ISO_DURATION.test(v) || v === "P" || v === "PT" || v.endsWith("T"))
    return false;
  return /\d/.test(v);
}
function isIsoCycle(v) {
  const slash = v.indexOf("/");
  if (slash < 0)
    return isIsoDuration(v);
  const repeat = v.slice(0, slash);
  const interval = v.slice(slash + 1);
  return /^R\d*$/.test(repeat) && isIsoDuration(interval);
}
var ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
function isFeel(v) {
  return v.startsWith("=") && v.length > 1;
}
function assertTimerDuration(kind, value) {
  const v = typeof value === "string" ? value.trim() : "";
  if (v === "" || !isFeel(v) && !isIsoDuration(v)) {
    throw new Error(`${kind} "${value}" is not an ISO-8601 duration (e.g. PT1M30S, P1DT6H) or a FEEL expression (=...)`);
  }
}
function assertTimerCycle(kind, value) {
  const v = typeof value === "string" ? value.trim() : "";
  if (v === "" || !isFeel(v) && !isIsoCycle(v)) {
    throw new Error(`${kind} "${value}" is not an ISO-8601 repeating interval (e.g. R/PT1H, R5/PT30M), a bare duration (e.g. PT1H), or a FEEL expression (=...)`);
  }
}
function assertTimerDate(kind, value) {
  const v = typeof value === "string" ? value.trim() : "";
  if (v === "" || !isFeel(v) && !ISO_DATE.test(v)) {
    throw new Error(`${kind} "${value}" is not an ISO-8601 instant (e.g. 2026-01-01T09:00:00Z) or a FEEL expression (=...)`);
  }
}

// node_modules/@nanobpm/workflow/dist/nodes/registry.js
var kinds = /* @__PURE__ */ new Map();
function registerNodeKind(kind, handlers) {
  if (kinds.has(kind)) {
    throw new Error(`flow-node kind "${kind}" is already registered`);
  }
  const walk = handlers.walk;
  const emit = handlers.emit;
  kinds.set(kind, {
    builderMethod: handlers.builderMethod,
    build: handlers.build,
    walk: walk ? (node, recurse) => walk(narrow(node, kind), recurse) : void 0,
    emit: (node, incoming, loop, api) => emit(narrow(node, kind), incoming, loop, api)
  });
}
function narrow(node, kind) {
  if (isKind(node, kind))
    return node;
  throw new Error(`internal: node of kind "${node.kind}" dispatched to handler for "${kind}"`);
}
function isKind(node, kind) {
  return node.kind === kind;
}
function requireNodeKind(kind) {
  const h = kinds.get(kind);
  if (!h) {
    throw new Error(`no handler registered for flow-node kind "${kind}" \u2014 did its module under src/nodes/ import and call registerNodeKind()?`);
  }
  return h;
}
function eachNodeKind() {
  return kinds.entries();
}

// node_modules/@nanobpm/workflow/dist/nodes/boundary.js
var BOUNDARY_HOST_KINDS = /* @__PURE__ */ new Set(["run", "task"]);
function isFeel2(value) {
  return value.startsWith("=");
}
function renderBoundary(id, node, outg) {
  const nameAttr = node.label ? ` name="${escapeXml(node.label)}"` : "";
  const cancelAttr = node.interrupting ? "" : ` cancelActivity="false"`;
  const durType = isFeel2(node.timer) ? ` xsi:type="bpmn:tFormalExpression"` : "";
  return `    <bpmn:boundaryEvent id="${id}"${nameAttr} attachedToRef="${escapeXml(node.attachedTo)}"${cancelAttr}>
      ${outgoingOnly(outg)}
      <bpmn:timerEventDefinition>
        <bpmn:timeDuration${durType}>${escapeXml(node.timer)}</bpmn:timeDuration>
      </bpmn:timerEventDefinition>
    </bpmn:boundaryEvent>`;
}
registerNodeKind("boundary", {
  build: (api) => (opts) => {
    if (!opts || typeof opts !== "object") {
      throw new Error(`boundary(...) needs { timer, onTimeout }`);
    }
    if (typeof opts.timer !== "string" || opts.timer.trim() === "") {
      throw new Error(`boundary(...) needs a { timer } duration (an ISO-8601 duration or a FEEL =expression)`);
    }
    const duration = opts.timer.trim();
    assertTimerDuration("boundary(...) timer", duration);
    if (typeof opts.onTimeout !== "function") {
      throw new Error(`boundary(...) needs an { onTimeout } escalation body (b) => {\u2026}`);
    }
    if (opts.interrupting !== void 0 && typeof opts.interrupting !== "boolean") {
      throw new Error(`boundary(...) { interrupting } must be a boolean`);
    }
    if (opts.fireAndForget !== void 0 && typeof opts.fireAndForget !== "boolean") {
      throw new Error(`boundary(...) { fireAndForget } must be a boolean`);
    }
    if (opts.name !== void 0 && typeof opts.name !== "string") {
      throw new Error(`boundary(...) { name } must be a string`);
    }
    const host = api.out[api.out.length - 1];
    if (!host) {
      throw new Error(`boundary(...) must follow the activity it attaches to (e.g. w.run(...).boundary(...))`);
    }
    if (!BOUNDARY_HOST_KINDS.has(host.kind) || !("name" in host) || typeof host.name !== "string") {
      throw new Error(`boundary(...) can only attach to a named activity (run/task), not a "${host.kind}"`);
    }
    const onTimeout = api.child(opts.onTimeout, false);
    if (onTimeout.length === 0) {
      throw new Error(`boundary(...) needs a non-empty { onTimeout } escalation body (its outgoing flow has nowhere to go)`);
    }
    api.out.push({
      kind: "boundary",
      attachedTo: host.name,
      timer: duration,
      interrupting: opts.interrupting ?? true,
      fireAndForget: opts.fireAndForget ?? false,
      onTimeout,
      label: opts.name
    });
    return api.self();
  },
  walk: (node, recurse) => {
    recurse(node.onTimeout);
  },
  emit: (node, incoming, loop, api) => {
    const beId = `Be_${api.nextGw()}`;
    api.addNode({
      id: beId,
      render: (_inc, outg) => renderBoundary(beId, node, outg)
    });
    const escalation = api.newEdge(beId);
    const escOut = api.emitList(node.onTimeout, [escalation], loop);
    if (node.fireAndForget) {
      if (escOut.length > 0) {
        const endId = `${beId}_End`;
        api.addPlainEnd(endId);
        api.connect(escOut, endId);
      }
      return [...incoming];
    }
    return [...incoming, ...escOut];
  }
});

// node_modules/@nanobpm/workflow/dist/nodes/branch.js
registerNodeKind("branch", {
  build: (api) => (condition, arms) => {
    if (typeof condition !== "string" || condition.trim() === "") {
      throw new Error(`branch() needs a non-empty FEEL condition`);
    }
    if (!arms || typeof arms.then !== "function")
      throw new Error(`branch("${condition}") needs a then arm`);
    if (arms.else !== void 0 && typeof arms.else !== "function") {
      throw new Error(`branch("${condition}") else arm must be a block (b) => {\u2026}`);
    }
    api.out.push({
      kind: "branch",
      condition,
      then: api.child(arms.then, false),
      else: arms.else ? api.child(arms.else, false) : void 0
    });
    return api.self();
  },
  walk: (node, recurse) => {
    recurse(node.then);
    if (node.else)
      recurse(node.else);
  },
  emit: (node, incoming, loop, api) => {
    const id = `Gw_${api.nextGw()}`;
    const gw = api.addGateway(id);
    api.connect(incoming, id);
    const te = api.newEdge(id, { condition: feel(node.condition), name: "then" });
    const out = api.emitList(node.then, [te], loop);
    const ee = api.newEdge(id, { name: "else" });
    gw.defaultFlow = ee.id;
    out.push(...api.emitList(node.else ?? [], [ee], loop));
    return out;
  }
});

// node_modules/@nanobpm/workflow/dist/nodes/break.js
registerNodeKind("break", {
  build: (api) => () => {
    if (api.loopDepth === 0)
      throw new Error(`break() is only valid inside a loop`);
    api.out.push({ kind: "break" });
    return api.self();
  },
  emit: (_node, incoming, loop, api) => {
    if (!loop)
      throw new Error(`break outside a loop in flow "${api.flowId}"`);
    loop.breaks.push(...incoming);
    return [];
  }
});

// node_modules/@nanobpm/workflow/dist/nodes/continue.js
registerNodeKind("continue", {
  build: (api) => () => {
    if (api.loopDepth === 0)
      throw new Error(`continue() is only valid inside a loop`);
    api.out.push({ kind: "continue" });
    return api.self();
  },
  emit: (_node, incoming, loop, api) => {
    if (!loop)
      throw new Error(`continue outside a loop in flow "${api.flowId}"`);
    api.connect(incoming, loop.headId);
    return [];
  }
});

// node_modules/@nanobpm/workflow/dist/nodes/end.js
registerNodeKind("end", {
  build: (api) => (name, opts) => {
    if (name !== void 0 && typeof name === "object") {
      opts = name;
      name = void 0;
    }
    if (opts !== void 0 && (opts === null || typeof opts !== "object")) {
      throw new Error(`end() options must be an object like { terminate: true }`);
    }
    const terminate = opts?.terminate === void 0 ? false : opts.terminate;
    if (typeof terminate !== "boolean")
      throw new Error(`end() { terminate } must be true or false`);
    if (name !== void 0) {
      if (typeof name !== "string")
        throw new Error(`end() name must be a string`);
      api.claim(name);
      api.out.push({ kind: "end", name, terminate });
    } else {
      api.out.push({ kind: "end", terminate });
    }
    return api.self();
  },
  emit: (node, incoming, _loop, api) => {
    let id = node.name ?? `End_${api.nextGw()}`;
    while (node.name === void 0 && id === api.flowId)
      id = `End_${api.nextGw()}`;
    api.addNode({
      id,
      render: (inc) => node.terminate ? `    <bpmn:endEvent id="${escapeXml(id)}">
` + inc.map((f) => `      <bpmn:incoming>${escapeXml(f)}</bpmn:incoming>
`).join("") + `      <bpmn:terminateEventDefinition />
    </bpmn:endEvent>` : `    <bpmn:endEvent id="${escapeXml(id)}">` + inc.map((f) => `<bpmn:incoming>${escapeXml(f)}</bpmn:incoming>`).join("") + `</bpmn:endEvent>`
    });
    api.connect(incoming, id);
    return [];
  }
});

// node_modules/@nanobpm/workflow/dist/io-mapping.js
function isNonBlankString(v) {
  return typeof v === "string" && v.trim() !== "";
}
function isEntry(e) {
  if (e === null || typeof e !== "object")
    return false;
  if (!("source" in e) || !("target" in e))
    return false;
  const { source, target } = e;
  return isNonBlankString(source) && isNonBlankString(target);
}
function validateEntries(label, dir, entries) {
  if (entries === void 0)
    return;
  if (!Array.isArray(entries))
    throw new Error(`${label} io.${dir} must be an array of { source, target }`);
  for (const e of entries) {
    if (!isEntry(e)) {
      throw new Error(`${label} io.${dir} entries must be { source: non-empty string, target: non-empty string }`);
    }
  }
}
function assertIoMapping(label, io) {
  if (io === void 0)
    return;
  if (io === null || typeof io !== "object" || Array.isArray(io)) {
    throw new Error(`${label} { io } must be an object { input?, output? }`);
  }
  validateEntries(label, "input", io.input);
  validateEntries(label, "output", io.output);
}
function renderMappings(entries, tag) {
  if (!entries || entries.length === 0)
    return "";
  return entries.map((e) => `          <zeebe:${tag} source="${escapeXml(e.source)}" target="${escapeXml(e.target)}" />
`).join("");
}
function renderIoMapping(io) {
  if (!io || (io.input?.length ?? 0) === 0 && (io.output?.length ?? 0) === 0)
    return "";
  return `        <zeebe:ioMapping>
` + renderMappings(io.input, "input") + renderMappings(io.output, "output") + `        </zeebe:ioMapping>
`;
}

// node_modules/@nanobpm/workflow/dist/nodes/task.js
function resolvePrompt(name, prompt) {
  if (typeof prompt !== "object" || prompt === null) {
    throw new Error(`task("${name}") prompt must be an object with a non-empty resourceId`);
  }
  const resourceId = prompt.resourceId;
  if (typeof resourceId !== "string" || resourceId.trim() === "") {
    throw new Error(`task("${name}") prompt.resourceId must be a non-empty string`);
  }
  const bindingType = prompt.bindingType === void 0 ? "latest" : prompt.bindingType;
  if (typeof bindingType !== "string" || bindingType.trim() === "") {
    throw new Error(`task("${name}") prompt.bindingType must be a non-empty string`);
  }
  const resolved = { resourceId: resourceId.trim(), bindingType: bindingType.trim() };
  if (prompt.append !== void 0) {
    if (typeof prompt.append !== "string" || prompt.append.trim() === "") {
      throw new Error(`task("${name}") prompt.append must be a non-empty string when provided`);
    }
    resolved.append = prompt.append.trim();
  }
  return resolved;
}
function taskExtensions(agent, prompt, io) {
  const marker = agent === true ? `        <zeebe:agentDefinition agentType="external" />
` : "";
  const linked = prompt !== void 0 ? `        <zeebe:linkedResources>
          <zeebe:linkedResource resourceId="${escapeXml(prompt.resourceId)}" bindingType="${escapeXml(prompt.bindingType ?? "latest")}" resourceType="GenericScript" linkName="prompt" />
        </zeebe:linkedResources>
` : "";
  const inputs = [...io?.input ?? []];
  if (prompt?.append !== void 0)
    inputs.push({ source: prompt.append, target: "appendPrompt" });
  const merged = { input: inputs, output: io?.output ?? [] };
  return marker + linked + renderIoMapping(merged);
}
function hasTaskExtensions(node) {
  return node.agent === true || node.prompt !== void 0 || node.io !== void 0;
}
registerNodeKind("task", {
  build: (api) => (name, opts) => {
    api.claim(name);
    const override = opts?.jobType;
    if (override !== void 0)
      assertJobType("task jobType", override);
    const prompt = opts?.prompt !== void 0 ? resolvePrompt(name, opts.prompt) : void 0;
    assertIoMapping(`task("${name}")`, opts?.io);
    if (opts?.agent !== void 0 && typeof opts.agent !== "boolean") {
      throw new Error(`task("${name}") agent must be a boolean when provided`);
    }
    const agent = opts?.agent ?? prompt !== void 0;
    api.out.push({
      kind: "task",
      name,
      envelopes: api.contractEnvelopes(name),
      jobType: override,
      prompt,
      agent,
      io: opts?.io
    });
    return api.self();
  },
  emit: (node, incoming, _loop, api) => {
    if (!hasTaskExtensions(node)) {
      api.addServiceTask(node);
      api.connect(incoming, node.name);
      return [api.newEdge(node.name)];
    }
    api.addServiceTask(node, { extraExt: taskExtensions(node.agent, node.prompt, node.io) });
    api.connect(incoming, node.name);
    return [api.newEdge(node.name)];
  }
});

// node_modules/@nanobpm/workflow/dist/nodes/forEach.js
function miCharacteristics(node) {
  const seq = node.sequential ? "true" : "false";
  const attrs = [
    `inputCollection="${escapeXml(`=${node.collection}`)}"`,
    `inputElement="${escapeXml(node.itemVar)}"`
  ];
  if (node.outputCollection)
    attrs.push(`outputCollection="${escapeXml(node.outputCollection)}"`);
  if (node.outputElement)
    attrs.push(`outputElement="${escapeXml(`=${node.outputElement}`)}"`);
  const completion = node.completionCondition ? `      <bpmn:completionCondition>${escapeXml(`=${node.completionCondition}`)}</bpmn:completionCondition>
` : "";
  return `      <bpmn:multiInstanceLoopCharacteristics isSequential="${seq}">
        <bpmn:extensionElements>
          <zeebe:loopCharacteristics ${attrs.join(" ")} />
        </bpmn:extensionElements>
` + completion + `      </bpmn:multiInstanceLoopCharacteristics>
`;
}
registerNodeKind("forEach", {
  build: (api) => (collection, itemVar, body, opts) => {
    if (typeof collection !== "string" || collection.trim() === "") {
      throw new Error(`forEach() needs a non-empty FEEL collection expression`);
    }
    const collExpr = collection.trim().replace(/^=/, "").trim();
    if (collExpr === "") {
      throw new Error(`forEach() collection expression is empty after stripping the leading "="`);
    }
    assertIdent("forEach itemVar", itemVar);
    if (typeof body !== "function")
      throw new Error(`forEach("${itemVar}") needs a body function`);
    const nodes = api.childScoped(body);
    if (nodes.length === 0)
      throw new Error(`forEach("${itemVar}") body declared no steps`);
    const node = { kind: "forEach", collection: collExpr, itemVar, body: nodes };
    if (opts?.sequential)
      node.sequential = true;
    if (opts?.outputCollection !== void 0) {
      assertIdent("forEach outputCollection", opts.outputCollection);
      node.outputCollection = opts.outputCollection;
    }
    if (opts?.outputElement !== void 0) {
      if (typeof opts.outputElement !== "string" || opts.outputElement.trim() === "") {
        throw new Error(`forEach("${itemVar}") outputElement must be a non-empty FEEL expression`);
      }
      const outEl = opts.outputElement.trim().replace(/^=/, "").trim();
      if (outEl === "") {
        throw new Error(`forEach("${itemVar}") outputElement is empty after stripping the leading "="`);
      }
      node.outputElement = outEl;
    }
    if (opts?.completionCondition !== void 0) {
      if (typeof opts.completionCondition !== "string" || opts.completionCondition.trim() === "") {
        throw new Error(`forEach("${itemVar}") completionCondition must be a non-empty FEEL expression`);
      }
      const compCond = opts.completionCondition.trim().replace(/^=/, "").trim();
      if (compCond === "") {
        throw new Error(`forEach("${itemVar}") completionCondition is empty after stripping the leading "="`);
      }
      node.completionCondition = compCond;
    }
    if (node.outputElement && !node.outputCollection) {
      throw new Error(`forEach("${itemVar}") outputElement needs an outputCollection to collect into`);
    }
    api.out.push(node);
    return api.self();
  },
  walk: (node, recurse) => recurse(node.body),
  emit: (node, incoming, _loop, api) => {
    const mi = miCharacteristics(node);
    const only = node.body.length === 1 ? node.body[0] : void 0;
    if (only && (only.kind === "run" || only.kind === "task" && !hasTaskExtensions(only))) {
      api.addServiceTask(only, { mi });
      api.connect(incoming, only.name);
      return [api.newEdge(only.name)];
    }
    const subId = `Sub_${api.nextGw()}`;
    api.addSubProcess(subId, mi);
    api.connect(incoming, subId);
    api.pushScope(subId);
    const startId = `${subId}_start`;
    api.addPlainStart(startId);
    const innerOut = api.emitList(node.body, [api.newEdge(startId)], null);
    if (innerOut.length > 0) {
      const endId = `${subId}_end`;
      api.addPlainEnd(endId);
      api.connect(innerOut, endId);
    }
    api.popScope();
    return [api.newEdge(subId)];
  }
});

// node_modules/@nanobpm/workflow/dist/nodes/human.js
function renderAssignment(node) {
  if (node.assignee === void 0 && node.candidateGroups === void 0)
    return "";
  const attrs = [
    node.assignee !== void 0 ? ` assignee="${escapeXml(node.assignee)}"` : "",
    node.candidateGroups !== void 0 ? ` candidateGroups="${escapeXml(node.candidateGroups)}"` : ""
  ].join("");
  return `        <zeebe:assignmentDefinition${attrs} />
`;
}
function renderUserTask(node, inc, outg) {
  const id = node.name;
  const ext = `      <bpmn:extensionElements>
        <zeebe:formDefinition formId="${escapeXml(node.form)}" />
        <zeebe:userTask />
` + renderAssignment(node) + renderIoMapping(node.io) + `      </bpmn:extensionElements>`;
  return `    <bpmn:userTask id="${escapeXml(id)}" name="${escapeXml(id)}">
` + ext + "\n" + incomingOutgoing(inc, outg) + `    </bpmn:userTask>`;
}
registerNodeKind("human", {
  build: (api) => (name, opts) => {
    api.claim(name);
    if (opts === null || typeof opts !== "object") {
      throw new Error(`human("${name}") needs an options object { form, \u2026 }`);
    }
    if (!isNonBlankString(opts.form)) {
      throw new Error(`human("${name}") needs a non-empty { form } (the zeebe:formDefinition form id)`);
    }
    if (opts.assignee !== void 0 && !isNonBlankString(opts.assignee)) {
      throw new Error(`human("${name}") { assignee } must be a non-empty string`);
    }
    if (opts.candidateGroups !== void 0 && !isNonBlankString(opts.candidateGroups)) {
      throw new Error(`human("${name}") { candidateGroups } must be a non-empty string`);
    }
    assertIoMapping(`human("${name}")`, opts.io);
    api.out.push({
      kind: "human",
      name,
      form: opts.form,
      assignee: opts.assignee,
      candidateGroups: opts.candidateGroups,
      io: opts.io
    });
    return api.self();
  },
  emit: (node, incoming, _loop, api) => {
    api.addNode({ id: node.name, render: (inc, outg) => renderUserTask(node, inc, outg) });
    api.connect(incoming, node.name);
    return [api.newEdge(node.name)];
  }
});

// node_modules/@nanobpm/workflow/dist/nodes/loop.js
registerNodeKind("loop", {
  build: (api) => (body) => {
    if (typeof body !== "function")
      throw new Error(`loop() needs a body function`);
    api.out.push({ kind: "loop", body: api.child(body, true) });
    return api.self();
  },
  walk: (node, recurse) => recurse(node.body),
  emit: (node, incoming, _loop, api) => {
    const headId = `Loop_${api.nextGw()}`;
    api.addGateway(headId);
    api.connect(incoming, headId);
    const ctx = { headId, breaks: [] };
    const headOut = api.newEdge(headId);
    const bodyOut = api.emitList(node.body, [headOut], ctx);
    api.connect(bodyOut, headId);
    return ctx.breaks;
  }
});

// node_modules/@nanobpm/workflow/dist/nodes/parallel.js
function hasPlainEnd(list) {
  let found = false;
  const visit = (nodes) => {
    for (const n of nodes) {
      if (found)
        return;
      if (n.kind === "end" && !n.terminate)
        found = true;
      else if (n.kind === "boundary" && !n.interrupting)
        continue;
      else if (n.kind !== "forEach")
        requireNodeKind(n.kind).walk?.(n, visit);
    }
  };
  visit(list);
  return found;
}
registerNodeKind("parallel", {
  build: (api) => (branches) => {
    if (!Array.isArray(branches) || branches.length < 2) {
      throw new Error(`parallel() needs at least two branch blocks`);
    }
    for (const fn of branches) {
      if (typeof fn !== "function")
        throw new Error(`parallel() branches must all be blocks (b) => {\u2026}`);
    }
    const bodies = branches.map((fn) => api.childScoped(fn));
    if (bodies.some(hasPlainEnd)) {
      throw new Error(`parallel(): a branch can't end() on its own \u2014 the join would wait for it forever. Use end({ terminate: true }) to end the whole instance, or let the branch reach the join`);
    }
    api.out.push({ kind: "parallel", branches: bodies });
    return api.self();
  },
  walk: (node, recurse) => {
    for (const branch of node.branches)
      recurse(branch);
  },
  emit: (node, incoming, loop, api) => {
    const splitId = `Gw_${api.nextGw()}`;
    api.addParallelGateway(splitId);
    api.connect(incoming, splitId);
    const joinId = `Gw_${api.nextGw()}`;
    api.addParallelGateway(joinId);
    for (const branch of node.branches) {
      const e = api.newEdge(splitId);
      const branchOut = api.emitList(branch, [e], loop);
      if (branchOut.length === 0) {
        throw new Error(`parallel(): every path of a branch ends, so it never reaches the join \u2014 the steps after parallel() could run before it terminates. Make the end conditional, or move it after parallel()`);
      }
      api.connect(branchOut, joinId);
    }
    return [api.newEdge(joinId)];
  }
});

// node_modules/@nanobpm/workflow/dist/nodes/race.js
function hasSignal(spec) {
  return "signal" in spec && spec.signal !== null && typeof spec.signal === "object";
}
function hasTimer(spec) {
  return "timer" in spec && spec.timer !== null && typeof spec.timer === "object";
}
registerNodeKind("race", {
  build: (api) => (arms) => {
    if (arms === null || typeof arms !== "object") {
      throw new Error(`race() needs an arms object { "<name>": { signal | timer, do } }`);
    }
    const entries = Object.entries(arms);
    if (entries.length < 2) {
      throw new Error(`race() needs at least two arms (an event-based gateway with fewer than two events is degenerate)`);
    }
    const compiled = [];
    for (const [name, spec] of entries) {
      if (spec === null || typeof spec !== "object") {
        throw new Error(`race() arm "${name}" must be an object { signal | timer, do }`);
      }
      const isSignal = hasSignal(spec);
      const isTimer = hasTimer(spec);
      if (isSignal === isTimer) {
        throw new Error(`race() arm "${name}" needs exactly one of { signal: { correlationKey } } or { timer: { after | at } }`);
      }
      if (typeof spec.do !== "function") {
        throw new Error(`race() arm "${name}" needs a do block (b) => {\u2026}`);
      }
      api.claim(name);
      let event;
      if (isSignal) {
        const rawKey = spec.signal.correlationKey;
        if (typeof rawKey !== "string" || rawKey.trim() === "") {
          throw new Error(`race() arm "${name}" signal needs a non-empty { correlationKey }`);
        }
        const correlationKey = rawKey.trim();
        assertIdent(`race() arm "${name}" signal correlationKey`, correlationKey);
        event = { kind: "signal", name, correlationKey, payload: api.contracts[name]?.in };
      } else {
        const timer = spec.timer;
        const hasAfterKey = "after" in timer;
        const hasAtKey = "at" in timer;
        if (hasAfterKey === hasAtKey) {
          throw new Error(`race() arm "${name}" timer needs exactly one of { after } (a delay) or { at } (an instant)`);
        }
        if ("after" in timer) {
          if (typeof timer.after !== "string") {
            throw new Error(`race() arm "${name}" timer { after } must be a string duration`);
          }
          const after = timer.after.trim();
          assertTimerDuration(`race() arm "${name}" timer after`, after);
          event = { kind: "timer", name, after };
        } else {
          if (typeof timer.at !== "string") {
            throw new Error(`race() arm "${name}" timer { at } must be a string instant`);
          }
          const at = timer.at.trim();
          assertTimerDate(`race() arm "${name}" timer at`, at);
          event = { kind: "timer", name, at };
        }
      }
      compiled.push({ event, body: api.child(spec.do, false) });
    }
    api.out.push({ kind: "race", arms: compiled });
    return api.self();
  },
  walk: (node, recurse) => {
    for (const arm of node.arms)
      recurse([arm.event, ...arm.body]);
  },
  emit: (node, incoming, loop, api) => {
    const gwId = `Gw_${api.nextGw()}`;
    api.addNode(eventBasedGateway(gwId, api.currentScope()));
    api.connect(incoming, gwId);
    const out = [];
    for (const arm of node.arms) {
      const fork = api.newEdge(gwId);
      const afterCatch = requireNodeKind(arm.event.kind).emit(arm.event, [fork], loop, api);
      out.push(...api.emitList(arm.body, afterCatch, loop));
    }
    return out;
  }
});
function eventBasedGateway(id, scope) {
  return {
    id,
    scope,
    render: (inc, outg) => `    <bpmn:eventBasedGateway id="${escapeXml(id)}">
` + incomingOutgoing(inc, outg) + `    </bpmn:eventBasedGateway>`
  };
}

// node_modules/@nanobpm/workflow/dist/nodes/run.js
registerNodeKind("run", {
  build: (api) => (name, handler, opts) => {
    api.claim(name);
    if (typeof handler !== "function")
      throw new Error(`run("${name}") needs a handler function`);
    assertIoMapping(`run("${name}")`, opts?.io);
    const timeoutMs = opts?.timeoutMs;
    if (timeoutMs !== void 0 && (!Number.isInteger(timeoutMs) || timeoutMs <= 0)) {
      throw new Error(`run("${name}"): timeoutMs must be a positive integer (ms)`);
    }
    api.handlers[name] = handler;
    api.out.push({
      kind: "run",
      name,
      envelopes: api.contractEnvelopes(name),
      io: opts?.io,
      ...timeoutMs !== void 0 ? { timeoutMs } : {}
    });
    return api.self();
  },
  emit: (node, incoming, _loop, api) => {
    api.addServiceTask(node, node.io !== void 0 ? { extraExt: renderIoMapping(node.io) } : {});
    api.connect(incoming, node.name);
    return [api.newEdge(node.name)];
  }
});

// node_modules/@nanobpm/workflow/dist/nodes/signal.js
registerNodeKind("signal", {
  build: (api) => (name, opts) => {
    api.claim(name);
    if (!opts || typeof opts.correlationKey !== "string" || opts.correlationKey.trim() === "") {
      throw new Error(`signal("${name}") needs { correlationKey }`);
    }
    const correlationKey = opts.correlationKey.trim();
    assertIdent(`signal("${name}") correlationKey`, correlationKey);
    api.out.push({ kind: "signal", name, correlationKey, payload: api.contracts[name]?.in });
    return api.self();
  },
  emit: (node, incoming, _loop, api) => {
    api.addCatchEvent(node);
    api.connect(incoming, node.name);
    api.recordEnvelope(node.payload);
    return [api.newEdge(node.name)];
  }
});

// node_modules/@nanobpm/workflow/dist/nodes/switch.js
registerNodeKind("switch", {
  build: (api) => (subject, cases) => {
    if (typeof subject !== "string" || subject.trim() === "") {
      throw new Error(`switch() needs a non-empty subject expression`);
    }
    if (cases === null || typeof cases !== "object") {
      throw new Error(`switch("${subject}") needs a cases object { value: (b) => {\u2026} }`);
    }
    const caseNodes = [];
    for (const [value, fn] of Object.entries(cases)) {
      if (value === "default")
        continue;
      if (typeof fn !== "function")
        throw new Error(`switch("${subject}") cases must be blocks (b) => {\u2026}`);
      caseNodes.push({ value, body: api.child(fn, false) });
    }
    if (caseNodes.length === 0)
      throw new Error(`switch("${subject}") needs at least one case`);
    if (cases.default !== void 0 && typeof cases.default !== "function") {
      throw new Error(`switch("${subject}") default must be a block (b) => {\u2026}`);
    }
    const def = cases.default ? api.child(cases.default, false) : void 0;
    api.out.push({ kind: "switch", subject, cases: caseNodes, default: def });
    return api.self();
  },
  walk: (node, recurse) => {
    for (const c of node.cases)
      recurse(c.body);
    if (node.default)
      recurse(node.default);
  },
  emit: (node, incoming, loop, api) => {
    const id = `Gw_${api.nextGw()}`;
    const gw = api.addGateway(id, node.subject);
    api.connect(incoming, id);
    const out = [];
    for (const c of node.cases) {
      const e = api.newEdge(id, { condition: feelEquals(node.subject, c.value), name: c.value });
      out.push(...api.emitList(c.body, [e], loop));
    }
    const de = api.newEdge(id, { name: "default" });
    gw.defaultFlow = de.id;
    out.push(...api.emitList(node.default ?? [], [de], loop));
    return out;
  }
});

// node_modules/@nanobpm/workflow/dist/nodes/timer.js
registerNodeKind("timer", {
  build: (api) => (name, opts) => {
    api.claim(name);
    if (!opts || typeof opts !== "object") {
      throw new Error(`timer("${name}") needs exactly one of { after } (a delay) or { at } (an instant)`);
    }
    const hasAfter = "after" in opts && typeof opts.after === "string";
    const hasAt = "at" in opts && typeof opts.at === "string";
    if (hasAfter === hasAt) {
      throw new Error(`timer("${name}") needs exactly one of { after } (a delay) or { at } (an instant)`);
    }
    if ("after" in opts) {
      const after = opts.after.trim();
      assertTimerDuration(`timer("${name}") after`, after);
      api.out.push({ kind: "timer", name, after });
    } else {
      const at = opts.at.trim();
      assertTimerDate(`timer("${name}") at`, at);
      api.out.push({ kind: "timer", name, at });
    }
    return api.self();
  },
  emit: (node, incoming, _loop, api) => {
    api.addTimerCatchEvent(node);
    api.connect(incoming, node.name);
    return [api.newEdge(node.name)];
  }
});

// node_modules/@nanobpm/workflow/dist/declarative.js
var RESERVED_PREFIXES = /^(Gw_|Loop_|Sub_|Msg_|f_|End_)/;
var TIMER_START_KEYS = ["cycle", "after", "at"];
function timerStartValue(spec, key) {
  switch (key) {
    case "cycle":
      return "cycle" in spec ? spec.cycle : void 0;
    case "after":
      return "after" in spec ? spec.after : void 0;
    case "at":
      return "at" in spec ? spec.at : void 0;
  }
}
function claimName(ctx, id, name) {
  assertIdent("step name", name);
  if (name === "Start" || name === "End" || name === id) {
    throw new Error(`step name "${name}" is reserved (collides with a generated BPMN id) in flow "${id}"`);
  }
  if (RESERVED_PREFIXES.test(name)) {
    throw new Error(`step name "${name}" uses a reserved prefix (Gw_/Loop_/Sub_/Msg_/f_/End_ are generated ids) in flow "${id}"`);
  }
  if (ctx.seen.has(name))
    throw new Error(`duplicate step name "${name}" in flow "${id}"`);
  ctx.seen.add(name);
}
function startInput(id, contracts) {
  const c = contracts.Start;
  if (!c)
    return void 0;
  if (c.out)
    throw new Error(`flow "${id}": the Start contract takes only \`in\` (the flow's input), not \`out\``);
  return c.in;
}
function contractEnvelopes(ctx, name) {
  const c = ctx.contracts[name];
  if (!c || !c.in && !c.out)
    return void 0;
  return { in: c.in, out: c.out };
}
function makeBuilder(id, out, ctx, isRoot = false) {
  const child = (fn, inLoop) => {
    const body = [];
    const depth = inLoop ? ctx.loopDepth + 1 : ctx.loopDepth;
    fn(makeBuilder(id, body, { ...ctx, loopDepth: depth }));
    return body;
  };
  const childScoped = (fn) => {
    const body = [];
    fn(makeBuilder(id, body, { ...ctx, loopDepth: 0 }));
    return body;
  };
  const setStartTimer = (t) => {
    if (!isRoot) {
      throw new Error(`startOn() is only valid at the top level of flow "${id}" (not inside switch/branch/loop)`);
    }
    if (out.length !== 0)
      throw new Error(`startOn() must be the first statement in flow "${id}"`);
    if (ctx.startTimer)
      throw new Error(`startOn() may be called only once in flow "${id}"`);
    ctx.startTimer = t;
  };
  let builderRef;
  const api = {
    id,
    isRoot,
    out,
    contracts: ctx.contracts,
    handlers: ctx.handlers,
    get loopDepth() {
      return ctx.loopDepth;
    },
    self() {
      if (!builderRef)
        throw new Error("internal: builder method invoked before assembly");
      return builderRef;
    },
    child,
    childScoped,
    claim(name) {
      claimName(ctx, id, name);
    },
    contractEnvelopes(name) {
      return contractEnvelopes(ctx, name);
    },
    setStartTimer
  };
  const methods = /* @__PURE__ */ Object.create(null);
  methods.startOn = startOnMethod(api);
  for (const [kind, handlers] of eachNodeKind()) {
    if (!handlers.build)
      continue;
    const method = handlers.builderMethod ?? kind;
    if (Object.hasOwn(methods, method)) {
      throw new Error(`two flow-node kinds both contribute the builder method "${method}"`);
    }
    methods[method] = handlers.build(api);
  }
  if (!isFlowBuilder(methods)) {
    throw new Error(assemblyFailureMessage(methods));
  }
  builderRef = methods;
  if (!isFlowBuilder(methods)) {
    throw new Error(assemblyFailureMessage(methods));
  }
  return methods;
}
var BUILTIN_BUILDER_METHODS = [
  "startOn",
  "run",
  "task",
  "signal",
  "timer",
  "switch",
  "branch",
  "loop",
  "parallel",
  "forEach",
  "break",
  "continue"
];
function isFlowBuilder(x) {
  return missingBuilderMethods(x).length === 0 && nonFunctionOwnProperties(x).length === 0;
}
function missingBuilderMethods(x) {
  return BUILTIN_BUILDER_METHODS.filter((method) => typeof Reflect.get(x, method) !== "function");
}
function nonFunctionOwnProperties(x) {
  return Object.getOwnPropertyNames(x).filter((k) => typeof Reflect.get(x, k) !== "function");
}
function assemblyFailureMessage(x) {
  const missing = missingBuilderMethods(x);
  if (missing.length > 0) {
    return `internal: assembled FlowBuilder is missing registered methods: ${missing.join(", ")}`;
  }
  const nonFunctions = nonFunctionOwnProperties(x);
  if (nonFunctions.length > 0) {
    const label = nonFunctions.length === 1 ? "property" : "properties";
    return `internal: assembled FlowBuilder has non-function own-${label}: ${nonFunctions.join(", ")}`;
  }
  return "internal: assembled FlowBuilder failed its assembly invariant";
}
function startOnMethod(api) {
  return (spec) => {
    const setCount = TIMER_START_KEYS.filter((key) => typeof timerStartValue(spec, key) === "string").length;
    if (setCount !== 1) {
      throw new Error(`startOn() needs exactly one of { cycle }, { after }, or { at } in flow "${api.id}"`);
    }
    if ("cycle" in spec) {
      const cycle = spec.cycle.trim();
      assertTimerCycle(`startOn cycle`, cycle);
      api.setStartTimer({ cycle });
    } else if ("after" in spec) {
      const after = spec.after.trim();
      assertTimerDuration(`startOn after`, after);
      api.setStartTimer({ after });
    } else {
      const at = spec.at.trim();
      assertTimerDate(`startOn at`, at);
      api.setStartTimer({ at });
    }
    return api.self();
  };
}
function defineFlow(id, second, third) {
  assertIdent("workflow id", id);
  if (typeof second !== "function" && (second === null || typeof second !== "object")) {
    throw new Error(`defineFlow("${id}"): the contracts argument must be an object`);
  }
  const contracts = typeof second === "function" ? {} : second;
  if (typeof second !== "function" && typeof third !== "function") {
    throw new Error(`defineFlow("${id}"): a build callback (w) => {\u2026} is required`);
  }
  const steps = [];
  const handlers = {};
  const ctx = { contracts, handlers, seen: /* @__PURE__ */ new Set(), loopDepth: 0 };
  if (typeof second === "function") {
    second(makeBuilder(id, steps, ctx, true));
  } else {
    const build = third;
    if (typeof build !== "function") {
      throw new Error(`defineFlow("${id}"): a build callback (w) => {\u2026} is required`);
    }
    build(makeBuilder(id, steps, ctx, true));
  }
  if (steps.length === 0)
    throw new Error(`flow "${id}" declared no steps`);
  const flow = { kind: "declarative", id, steps, handlers };
  if (ctx.startTimer)
    flow.startTimer = ctx.startTimer;
  const input = startInput(id, contracts);
  if (input)
    flow.input = input;
  return flow;
}
var feel = (expr) => `=${expr}`;
var feelEquals = (subject, value) => `=${subject} = "${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
function incomingOutgoing(inc, outg) {
  return inc.map((f) => `      <bpmn:incoming>${f}</bpmn:incoming>
`).join("") + outg.map((f) => `      <bpmn:outgoing>${f}</bpmn:outgoing>
`).join("");
}
var outgoingOnly = (outg) => outg.map((f) => `<bpmn:outgoing>${f}</bpmn:outgoing>`).join("");

// node_modules/@nanobpm/workflow/dist/envelope.js
var SCALARS = /* @__PURE__ */ new Set([
  "string",
  "integer",
  "number",
  "boolean",
  "datetime"
]);
var EnvelopeDef = class {
  name;
  fields;
  type;
  constructor(name, fields) {
    this.name = name;
    this.fields = fields;
  }
};
function normaliseField(name, spec) {
  if (spec === null || typeof spec !== "string" && typeof spec !== "object") {
    throw new Error(`envelope field "${name}": must be a scalar type or a { type, optional?, list? } object`);
  }
  const raw = typeof spec === "string" ? { type: spec } : spec;
  if (!SCALARS.has(raw.type)) {
    throw new Error(`envelope field "${name}": unknown type "${raw.type}" (expected one of ${[...SCALARS].join(", ")})`);
  }
  return {
    name,
    type: raw.type,
    optional: typeof spec === "object" && spec.optional === true,
    list: typeof spec === "object" && spec.list === true
  };
}
function envelope(name, fields) {
  assertIdent("envelope name", name);
  const list = Object.entries(fields).map(([k, v]) => normaliseField(k, v));
  if (list.length === 0)
    throw new Error(`envelope "${name}" declares no fields`);
  for (const f of list)
    assertIdent("envelope field name", f.name);
  return new EnvelopeDef(name, list);
}
var DATETIME = /^(\d{4})-(\d{2})-(\d{2})([Tt ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?([Zz]|[+-]\d{2}:?\d{2})?)?$/;
function isCalendarDate(y, m, d) {
  const leap = y % 4 === 0 && y % 100 !== 0 || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return m >= 1 && m <= 12 && d >= 1 && d <= days[m - 1];
}
function isDatetime(v) {
  if (typeof v !== "string")
    return false;
  const m = DATETIME.exec(v);
  return !!m && isCalendarDate(Number(m[1]), Number(m[2]), Number(m[3])) && !Number.isNaN(Date.parse(v));
}
function scalarProblem(type, v) {
  switch (type) {
    case "string":
      return typeof v === "string" ? void 0 : "must be a string";
    case "boolean":
      return typeof v === "boolean" ? void 0 : "must be true or false";
    case "number":
      return typeof v === "number" && Number.isFinite(v) ? void 0 : "must be a number";
    case "integer":
      return typeof v === "number" && Number.isInteger(v) ? void 0 : "must be a whole number";
    case "datetime":
      return isDatetime(v) ? void 0 : "must be an ISO 8601 date or date-time";
  }
}
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function validateEnvelope(env, value) {
  if (!isRecord(value))
    return [{ field: "", message: `${env.name} must be an object` }];
  const problems = [];
  for (const f of env.fields) {
    const v = Object.hasOwn(value, f.name) ? value[f.name] : void 0;
    if (v === void 0 || v === null && !f.optional) {
      if (!f.optional)
        problems.push({ field: f.name, message: "is required" });
      continue;
    }
    if (f.list) {
      if (!Array.isArray(v)) {
        problems.push({ field: f.name, message: "must be a list" });
        continue;
      }
      const bad = v.findIndex((item) => scalarProblem(f.type, item) !== void 0);
      if (bad >= 0)
        problems.push({ field: f.name, message: `item ${bad} ${scalarProblem(f.type, v[bad])}` });
      continue;
    }
    const p = scalarProblem(f.type, v);
    if (p)
      problems.push({ field: f.name, message: p });
  }
  return problems;
}

// src/index.ts
function defineStartForm(_input, hints) {
  return hints;
}
var jobContext = globalThis[/* @__PURE__ */ Symbol.for("agent-graph.job")] ??= new AsyncLocalStorage();
function jobProject() {
  return jobContext.getStore()?.project;
}
function jobSignal() {
  return jobContext.getStore()?.signal;
}
function projectPath(...parts) {
  return path.resolve(jobProject() ?? process.env.AGE_PROJECT ?? process.cwd(), ...parts);
}
function runInProject(project, fn, signal) {
  return jobContext.run({ project, signal }, fn);
}
function defineForms(forms) {
  return forms;
}
function defineAgentProfiles(profiles) {
  return profiles;
}
function defineAgents(agents) {
  return agents;
}
function sh(command, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", ["-c", command], {
      cwd: opts.cwd ?? jobProject() ?? process.env.AGE_PROJECT ?? process.cwd(),
      env: { ...process.env, ...opts.env },
      stdio: ["pipe", "pipe", "pipe"],
      timeout: opts.timeoutMs,
      signal: jobSignal()
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => stdout += d);
    child.stderr.on("data", (d) => stderr += d);
    child.on("error", reject);
    child.on("close", (code) => {
      const r = { stdout, stderr, code: code ?? -1 };
      if (r.code !== 0 && !opts.allowFail) {
        reject(new Error(`sh exited ${r.code}: ${command}
${stderr.slice(-2e3) || stdout.slice(-2e3)}`));
      } else resolve(r);
    });
    child.stdin.end(opts.input ?? "");
  });
}
async function claude(prompt, opts = {}) {
  const cmd = process.env.AGE_CLAUDE_CMD ?? "claude";
  const args = ["-p", "--output-format", "json", "--permission-mode", opts.permissionMode ?? "dontAsk"];
  if (opts.allowedTools?.length) args.push("--allowedTools", opts.allowedTools.join(","));
  if (opts.model) args.push("--model", opts.model);
  if (opts.system) args.push("--append-system-prompt", opts.system);
  if (opts.schema) args.push("--json-schema", JSON.stringify(opts.schema));
  const out = await new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd ?? jobProject() ?? process.env.AGE_PROJECT ?? process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: opts.timeoutMs ?? 30 * 6e4,
      signal: jobSignal()
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => stdout += d);
    child.stderr.on("data", (d) => stderr += d);
    child.on("error", reject);
    child.on(
      "close",
      (code) => code === 0 ? resolve(stdout) : reject(new Error(`${cmd} exited ${code}: ${(stderr || stdout).slice(-2e3)}`))
    );
    child.stdin.end(prompt);
  });
  const msg = JSON.parse(out);
  if (msg.is_error) throw new Error(`claude: ${msg.subtype ?? "error"}: ${String(msg.result ?? "").slice(0, 2e3)}`);
  let result = msg.structured_output ?? msg.result;
  if (opts.schema && typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {
    }
  }
  return { result, costUsd: msg.total_cost_usd, sessionId: msg.session_id, turns: msg.num_turns };
}
export {
  claude,
  defineAgentProfiles,
  defineAgents,
  defineFlow,
  defineForms,
  defineStartForm,
  envelope,
  jobProject,
  jobSignal,
  projectPath,
  runInProject,
  sh,
  validateEnvelope
};
