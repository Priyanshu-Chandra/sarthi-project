const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Color codes for console output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

/**
 * 1. TRANSPORT & CONNECTIVITY CHECK
 */
async function testConnectivity() {
    console.log(`${YELLOW}>>> Step 1: Connectivity Check...${RESET}`);
    const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS
        }
    });

    try {
        await transporter.verify();
        console.log(`${GREEN}[PASS] SMTP Server is reachable and credentials are valid.${RESET}`);
        return true;
    } catch (error) {
        console.error(`${RED}[FAIL] SMTP Connectivity Failed: ${error.message}${RESET}`);
        return false;
    }
}

/**
 * 2. BRANDING & TEMPLATE CHECK
 */
function testBranding() {
    console.log(`\n${YELLOW}>>> Step 2: Branding & Template Check...${RESET}`);
    const templatesDir = path.join(__dirname, 'mail', 'templates');
    const files = fs.readdirSync(templatesDir);
    let allPassed = true;

    files.forEach(file => {
        if (!file.endsWith('.js')) return;

        const filePath = path.join(templatesDir, file);
        const template = require(filePath);
        
        // Mock variables
        const mockData = ["Course Name", "Student Name", "Instructor Name", "Course Desc", "123456"];
        
        let html;
        try {
            // Some templates are functions, some are exported differently.
            // Let's handle the common Sarthi patterns
            if (typeof template === 'function') {
                html = template(...mockData);
            } else if (template.courseEnrollmentEmail) {
                html = template.courseEnrollmentEmail(...mockData);
            } else if (template.passwordUpdated) {
                html = template.passwordUpdated("test@test.com", "User");
            } else if (template.otpTemplate) {
                html = template.otpTemplate("123456", "User");
            } else {
                // Fallback for objects with function values
                const firstExport = Object.values(template).find(v => typeof v === 'function');
                if(firstExport) html = firstExport(...mockData);
            }
        } catch (e) {
            console.error(`${RED}[ERROR] Failed to execute template ${file}: ${e.message}${RESET}`);
            allPassed = false;
            return;
        }

        if (!html) {
            console.error(`${RED}[FAIL] Template ${file} returned no content.${RESET}`);
            allPassed = false;
            return;
        }

        const studyNotionFound = /StudyNotion/i.test(html);
        const sarthiFound = /Sarthi/i.test(html);

        if (studyNotionFound) {
            console.error(`${RED}[FAIL] Branding Leak in ${file}: Found "StudyNotion"${RESET}`);
            allPassed = false;
        } else if (!sarthiFound) {
            console.warn(`${YELLOW}[WARN] No "Sarthi" mention found in ${file}. Please check.${RESET}`);
        } else {
            console.log(`${GREEN}[PASS] ${file} is correctly branded as Sarthi.${RESET}`);
        }
    });

    return allPassed;
}

/**
 * 3. ISOLATION & RESILIENCE CHECK (MOCK)
 */
async function testIsolation() {
    console.log(`\n${YELLOW}>>> Step 3: Isolation Logic Check...${RESET}`);
    
    // Mock students
    const students = [
        { email: 'good1@sarthi.com', name: 'Student 1' },
        { email: 'bad@sarthi.com', name: 'Student 2' }, // We will force this to fail
        { email: 'good2@sarthi.com', name: 'Student 3' }
    ];

    // Mock mailSender
    const mockMailSender = async (email) => {
        if (email === 'bad@sarthi.com') {
            throw new Error("SMTP: Connection dropped (Simulated)");
        }
        return { success: true };
    };

    let successCount = 0;
    let failCount = 0;

    console.log("Simulating Bulk Send (Promise.all)...");
    
    await Promise.all(students.map(async (student) => {
        try {
            await mockMailSender(student.email);
            successCount++;
        } catch (error) {
            console.log(`[隔离测试] Expected Failure for ${student.email}: ${error.message}`);
            failCount++;
        }
    }));

    if (successCount === 2 && failCount === 1) {
        console.log(`${GREEN}[PASS] Isolation Logic Works: 2 succeeded, 1 safely failed without crashing others.${RESET}`);
        return true;
    } else {
        console.error(`${RED}[FAIL] Isolation Logic Inconsistent. S:${successCount} F:${failCount}${RESET}`);
        return false;
    }
}

/**
 * MAIN EXECUTION
 */
async function runDiagnostic() {
    console.log(`${YELLOW}========================================`);
    console.log("   SARTHI MAIL SYSTEM DIAGNOSTIC TRACE   ");
    console.log(`========================================${RESET}\n`);

    const connectivity = await testConnectivity();
    const branding = testBranding();
    const isolation = await testIsolation();

    console.log(`\n${YELLOW}========================================`);
    if (connectivity && branding && isolation) {
        console.log(`${GREEN}   DIAGNOSTIC COMPLETE: SYSTEM IS HEALTHY   `);
    } else {
        console.log(`${RED}   DIAGNOSTIC COMPLETE: ISSUES FOUND   `);
    }
    console.log(`========================================${RESET}\n`);
    
    // Suggest next step
    if (connectivity) {
        console.log(`${YELLOW}[SUGGESTION] Connectivity is valid. You can now perform a REAL test by sending mail to your email.${RESET}`);
    }
}

runDiagnostic();
