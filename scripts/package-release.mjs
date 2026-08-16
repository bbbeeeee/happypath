import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";

function run(command, argumentsList, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, { stdio: ["ignore", "pipe", "inherit"], ...options });
    let stdout = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} exited with status ${code ?? "unknown"}`));
    });
  });
}

await mkdir("release", { recursive: true });
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const packed = await run(npmCommand, ["pack", "--json", "--ignore-scripts", "--pack-destination", "release"]);
const packageResult = JSON.parse(packed)[0];
if (!packageResult?.filename) throw new Error("npm pack did not return a release filename");
const archivePath = `release/${packageResult.filename}`;
await run(process.execPath, ["scripts/smoke-release.mjs", archivePath], { stdio: "inherit" });
console.log(`${archivePath} (${packageResult.size} bytes, ${packageResult.entryCount} files)`);
