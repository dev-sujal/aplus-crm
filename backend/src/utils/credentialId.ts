import { Certificate } from "../models/Certificate.model.js";

export async function generateCredentialId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CC-${year}-`;

  const countThisYear = await Certificate.countDocuments({
    credentialId: { $regex: `^${prefix}` },
  });

  let sequence = countThisYear + 1;
  // Guard against a rare race where two requests land on the same count.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${prefix}${String(sequence).padStart(4, "0")}`;
    const exists = await Certificate.exists({ credentialId: candidate });
    if (!exists) return candidate;
    sequence += 1;
  }
  throw new Error("Could not generate a unique credential ID, please retry");
}
