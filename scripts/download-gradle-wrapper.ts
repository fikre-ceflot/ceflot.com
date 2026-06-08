import fs from 'fs';
import path from 'path';
import https from 'https';

const TARGET_DIR = path.join(process.cwd(), 'Ceflot Site');
const WRAPPER_DIR = path.join(TARGET_DIR, 'gradle', 'wrapper');

// List of candidate git references to try on official github repo in order
const REFS = ['v8.7.0', 'v8.7', 'v8.2.1', 'v8.5.0', 'v8.0.0', 'master'];

function ensureDirectoryExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

function downloadFile(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`Attempting download from: ${url}`);
    
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Handle redirect
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, destPath).then(resolve);
        } else {
          resolve(false);
        }
        return;
      }

      if (res.statusCode !== 200) {
        console.log(`Failed with HTTP status code: ${res.statusCode}`);
        resolve(false);
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Saved file to: ${destPath}`);
        resolve(true);
      });

      fileStream.on('error', (err) => {
        console.error(`Stream error: ${err.message}`);
        fs.unlink(destPath, () => {});
        resolve(false);
      });
    }).on('error', (err) => {
      console.error(`HTTP request error: ${err.message}`);
      resolve(false);
    });
  });
}

async function fetchFileWithFallbacks(relativeUrlPath: string, localDestPath: string) {
  for (const ref of REFS) {
    const url = `https://raw.githubusercontent.com/gradle/gradle/${ref}/${relativeUrlPath}`;
    const success = await downloadFile(url, localDestPath);
    if (success) {
      console.log(`Successfully downloaded ${relativeUrlPath} using release: ${ref}\n`);
      return true;
    }
  }
  console.error(`Could not download ${relativeUrlPath} from any release references.`);
  return false;
}

async function run() {
  console.log('--- STARTING CLEAN GRADLE WRAPPER SETUP ---');
  
  ensureDirectoryExists(TARGET_DIR);
  ensureDirectoryExists(WRAPPER_DIR);

  // 1. Download gradlew launcher script
  const gradlewPath = path.join(TARGET_DIR, 'gradlew');
  console.log('Downloading Unix gradlew launcher...');
  const gradlewSuccess = await fetchFileWithFallbacks('gradlew', gradlewPath);
  if (gradlewSuccess) {
    try {
      fs.chmodSync(gradlewPath, '755');
      console.log('Set 755 execute permissions on Ceflot Site/gradlew');
    } catch (e: any) {
      console.warn(`Could not set permissions: ${e.message}`);
    }
  }

  // 2. Download gradlew.bat launcher script
  const gradlewBatPath = path.join(TARGET_DIR, 'gradlew.bat');
  console.log('Downloading Windows gradlew.bat launcher...');
  await fetchFileWithFallbacks('gradlew.bat', gradlewBatPath);

  // 3. Download gradle-wrapper.jar
  const jarPath = path.join(WRAPPER_DIR, 'gradle-wrapper.jar');
  console.log('Downloading gradle-wrapper.jar binary...');
  await fetchFileWithFallbacks('gradle/wrapper/gradle-wrapper.jar', jarPath);

  console.log('--- GRADLE WRAPPER SETUP COMPLETED ---');
}

run().catch((err) => {
  console.error('Fatal execution error: ', err);
});
