const { copyFile, readFile, unlink, writeFile } = require("node:fs/promises");
const path = require("node:path");
const {
  Data,
  NtExecutable,
  NtExecutableResource,
  Resource
} = require("resedit");

module.exports = async function updateWindowsResources(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const packageJson = context.packager.info.metadata;
  const productName = context.packager.appInfo.productName;
  const executablePath = path.join(context.appOutDir, `${productName}.exe`);
  const temporaryPath = `${executablePath}.resources`;
  const versionMatch = /^(\d+)\.(\d+)\.(\d+)/.exec(packageJson.version);

  if (!versionMatch) {
    throw new Error(`无法把 ${packageJson.version} 转换为 Windows 文件版本`);
  }

  const numericVersion = `${versionMatch[1]}.${versionMatch[2]}.${versionMatch[3]}.0`;
  const executable = NtExecutable.from(await readFile(executablePath));
  const resources = NtExecutableResource.from(executable);
  const versionInfo = Resource.VersionInfo.fromEntries(resources.entries);

  if (versionInfo.length !== 1) {
    throw new Error(`无法唯一定位 ${executablePath} 的版本资源`);
  }

  versionInfo[0].setFileVersion(numericVersion);
  versionInfo[0].setProductVersion(numericVersion);
  for (const language of versionInfo[0].getAllLanguagesForStringValues()) {
    versionInfo[0].setStringValues(language, {
      CompanyName: typeof packageJson.author === "string" ? packageJson.author : "gooderno1",
      FileDescription: packageJson.description,
      FileVersion: packageJson.version,
      LegalCopyright: `Copyright © 2026 ${typeof packageJson.author === "string" ? packageJson.author : "gooderno1"}`,
      OriginalFilename: `${productName}.exe`,
      ProductName: productName,
      ProductVersion: packageJson.version
    });
  }
  versionInfo[0].outputToResourceEntries(resources.entries);

  const iconPath = path.join(context.packager.projectDir, "build", "app-icon.ico");
  const iconFile = Data.IconFile.from(await readFile(iconPath));
  const iconGroups = Resource.IconGroupEntry.fromEntries(resources.entries);
  for (const group of iconGroups) {
    Resource.IconGroupEntry.replaceIconsForResource(
      resources.entries,
      group.id,
      group.lang,
      iconFile.icons.map((item) => item.data)
    );
  }

  resources.outputResource(executable);
  await writeFile(temporaryPath, Buffer.from(executable.generate()));
  await copyFile(temporaryPath, executablePath);
  await unlink(temporaryPath);

  console.log(`已写入 Windows 资源元数据：${productName} ${packageJson.version}`);
};
