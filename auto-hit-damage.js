
const ID = "auto-hit-damage";

// Confirm the module is active.
Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") return;

  console.info(
    `${ID} | Active; D&D 5e version ${game.system.version}`
  );
});

// Find the natural d20 result.
function naturalD20(roll) {
  const die = roll.dice?.find(d => d.faces === 20);
  if (!die) return null;

  const result = die.results?.find(
    r => r.active && !r.discarded
  );

  return result?.result ?? null;
}

// Process attack rolls.
async function handleAttack(rolls, data) {
  try {
    const activity = data?.subject;
    const actor =
      activity?.actor ?? activity?.item?.actor;

    if (
      !activity ||
      !actor ||
      !Array.isArray(rolls) ||
      rolls.length !== 1
    ) return;

    // Prevent multiple clients from rolling damage.
    if (!actor.isOwner) return;

    const owners = game.users.filter(
      u => u.active &&
      actor.testUserPermission(u, "OWNER")
    );

    const responsible =
      owners.find(u => !u.isGM) ??
      owners.find(u => u.isGM);

    if (responsible?.id !== game.user.id) return;

    // Require exactly one target.
    const targets = [...game.user.targets];

    if (targets.length !== 1) {
      ui.notifications.warn(
        "Auto Hit Damage: Target exactly one token."
      );
      return;
    }

    const target = targets[0];

    // Retrieve target AC.
    const ac = Number(
      target.actor?.system?.attributes?.ac?.value
    );

    if (!Number.isFinite(ac)) {
      ui.notifications.warn(
        "Auto Hit Damage: Target AC unavailable."
      );
      return;
    }

    const roll = rolls[0];
    const natural = naturalD20(roll);

    if (natural == null) return;

    // Determine hit or miss.
    const critical =
      natural === 20 || Boolean(roll.isCritical);

    const fumble =
      natural === 1 || Boolean(roll.isFumble);

    const hit =
      !fumble && (critical || roll.total >= ac);

    console.info(
      `${ID} | ${actor.name} attacks ${target.name}`,
      {
        attack: roll.total,
        ac,
        critical,
        hit
      }
    );

    // Do not roll damage on a miss.
    if (!hit) return;

    // Check damage functionality.
    if (typeof activity.rollDamage !== "function") {
      ui.notifications.error(
        "Auto Hit Damage: No damage roller found."
      );
      return;
    }

    // Roll damage automatically.
    await activity.rollDamage({
      isCritical: critical,
      critical: critical,
      dialog: false
    });

  } catch (error) {
    console.error(
      `${ID} | Attack processing failed`,
      error
    );

    ui.notifications.error(
      "Auto Hit Damage failed. Check F12 console."
    );
  }
}

// Listen for D&D 5e attack rolls.
Hooks.on("dnd5e.postRollAttack", handleAttack);
