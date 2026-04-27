const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// 1. Add boilerplates and timers
const headerSearch = 'exports.roomKickedUsers = roomKickedUsers;';
const headerAdd = `
// Empty room cleanup grace period: roomId → timeoutId
const emptyRoomTimers = new Map();
const EMPTY_ROOM_GRACE_MS = 30 * 1000;

// Boilerplates for various languages
const DEFAULT_BOILERPLATES = {
  cpp: "#include <iostream>\\nusing namespace std;\\n\\nint main() {\\n    cout << \\"Hello, Sarthi!\\" << endl;\\n    return 0;\\n}",
  java: "public class Main {\\n    public static void main(String[] args) {\\n        System.out.println(\\"Hello, Sarthi!\\");\\n    }\\n}",
  python: "print(\\"Hello, Sarthi!\\")",
  javascript: "console.log(\\"Hello, Sarthi!\\");"
};`;

if (content.includes(headerSearch)) {
    content = content.replace(headerSearch, headerSearch + headerAdd);
}

// 2. Update roomCodeStates initialization
const initSearch = 'code: "// Start coding...\\n",';
const initReplace = `const initialLang = recovered?.language || "cpp";
        roomCodeStates.set(roomId, recovered || {
          code: DEFAULT_BOILERPLATES[initialLang] || "// Start coding here...\\n",
          language: initialLang,
          activeEditor: null,
          lastOutput: null,
          lastExecutionId: 0,
        });`;

// Find the whole block to replace
const initBlockRegex = /roomCodeStates\.set\(roomId, recovered \|\| \{[\s\S]+?\}\);/;
if (initBlockRegex.test(content)) {
    content = content.replace(initBlockRegex, initReplace);
}

// 3. Update empty room cleanup
const emptyCleanupSearch = 'if (participants.size === 0) {\n            console.log(`Empty room ${roomId}. Auto-cleaning up.`);\n            endSession(roomId, courseId, "empty");';
const emptyCleanupReplace = `if (participants.size === 0) {
            console.log(\`Empty room \${roomId}. Starting \${EMPTY_ROOM_GRACE_MS/1000}s cleanup timer.\`);
            const timer = setTimeout(() => {
              if (roomParticipants.get(roomId)?.size === 0) {
                 console.log(\`Grace period expired for empty room \${roomId}. Cleaning up.\`);
                 endSession(roomId, courseId, "empty");
              }
              emptyRoomTimers.delete(roomId);
            }, EMPTY_ROOM_GRACE_MS);
            emptyRoomTimers.set(roomId, timer);`;

if (content.includes('console.log(`Empty room ${roomId}. Auto-cleaning up.`);')) {
    content = content.replace(/if \(participants\.size === 0\) \{[\s\S]+?endSession\(roomId, courseId, "empty"\);/, emptyCleanupReplace);
}

// 4. Cancel timer on join
const joinSearch = 'console.log(`👨‍🏫 Instructor reconnected, grace timer cancelled for ${roomId}`);';
const joinAdd = `
          }

          // Cancel empty room cleanup if someone joins
          if (emptyRoomTimers.has(roomId)) {
            clearTimeout(emptyRoomTimers.get(roomId));
            emptyRoomTimers.delete(roomId);
            console.log(\`♻️  Cancelled empty room cleanup for \${roomId} (User joined)\`);`;

if (content.includes(joinSearch)) {
    content = content.replace(joinSearch, joinSearch + joinAdd);
}

fs.writeFileSync('server.js', content);
console.log('Backend changes applied successfully.');
