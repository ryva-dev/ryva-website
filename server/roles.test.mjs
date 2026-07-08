import assert from "node:assert/strict";
import test from "node:test";
import { ROLE_CONFIGS, getRoleConfig, getRoleTaskType, hasRoleConfig, listRoleSlugs, listSafeAutoExecuteTaskTypes } from "./roles.mjs";

test("all six marketplace workers have role configs", () => {
  const expected = ["mara-vale", "sloane-pierce", "etta-marsh", "rowan-feld", "june-okafor", "camille-roy"];
  for (const slug of expected) {
    assert.ok(hasRoleConfig(slug), `missing role config for ${slug}`);
  }
  assert.equal(listRoleSlugs().length, expected.length);
});

test("every role config is complete and internally consistent", () => {
  for (const [slug, config] of Object.entries(ROLE_CONFIGS)) {
    assert.equal(config.slug, slug);
    assert.ok(config.roleDefinition.length > 40, `${slug} needs a real role definition`);
    assert.ok(config.voice, `${slug} needs a voice`);
    assert.ok(Array.isArray(config.taskTypes) && config.taskTypes.length >= 4, `${slug} needs task types`);
    assert.ok(Array.isArray(config.autonomyPlaybook) && config.autonomyPlaybook.length >= 3, `${slug} needs an autonomy playbook`);
    assert.ok(config.chatGuidance, `${slug} needs chat guidance`);

    const typeIds = new Set(config.taskTypes.map((entry) => entry.id));
    assert.equal(typeIds.size, config.taskTypes.length, `${slug} has duplicate task type ids`);

    for (const starter of config.starterTaskTypes) {
      assert.ok(typeIds.has(starter), `${slug} starter task type ${starter} is not a defined task type`);
    }

    for (const taskType of config.taskTypes) {
      assert.ok(taskType.label, `${slug}/${taskType.id} needs a label`);
      assert.ok(taskType.outputType, `${slug}/${taskType.id} needs an outputType`);
      assert.ok(taskType.description.length > 20, `${slug}/${taskType.id} needs a description`);
      // Schema hints are handed to the LLM verbatim; they must be valid JSON.
      assert.doesNotThrow(() => JSON.parse(taskType.schemaHint), `${slug}/${taskType.id} schemaHint is not valid JSON`);
    }
  }
});

test("getRoleTaskType and safe auto-execute helpers work", () => {
  const mara = getRoleConfig("mara-vale");
  assert.ok(getRoleTaskType(mara, "creator_positioning"));
  assert.equal(getRoleTaskType(mara, "not_a_type"), null);
  assert.ok(listSafeAutoExecuteTaskTypes(mara).includes("ops_brief"));
  assert.equal(getRoleConfig("nonexistent"), null);
});
