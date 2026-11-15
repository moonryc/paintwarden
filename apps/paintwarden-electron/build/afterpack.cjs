// Complete all bundle mutations before the inside-out signer seals resources.
module.exports = async function afterPack(context) {
  await require("./afterpack-icons.cjs")(context);
  await require("./check-notices.cjs")(context);
};
