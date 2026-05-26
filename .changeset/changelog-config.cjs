/** @type {import("@changesets/types").ChangelogFunctions} */
const changelogFunctions = {
  getReleaseLine: async (changeset, _type) => {
    const lines = changeset.summary
      .split("\n")
      .map((l) => l.trimEnd())
      .filter(Boolean);

    const [first, ...rest] = lines;
    return [`\n- ${first}`, ...rest.map((l) => `  ${l}`)].join("\n");
  },

  getDependencyReleaseLine: async (_changesets, dependenciesUpdated) => {
    if (!dependenciesUpdated.length) return "";

    const lines = dependenciesUpdated.map(
      (dep) => `- Updated dependency \`${dep.name}\` to \`${dep.newVersion}\``,
    );
    return ["\n- Updated dependencies:", ...lines.map((l) => `  ${l}`)].join(
      "\n",
    );
  },
};

module.exports = changelogFunctions;
