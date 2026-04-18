const mongoose = require("mongoose");
const Problem = require("./models/Problem");
require("dotenv").config();

const problems = [
  {
    title: "Valid Anagram",
    slug: "valid-anagram",
    difficulty: "Easy",
    topic: "String",
    tags: ["string", "hashmap", "sorting"],
    description: "Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`, and `false` otherwise.",
    exampleInput: "s = \"anagram\", t = \"nagaram\"",
    exampleOutput: "true",
    constraints: "1 <= s.length, t.length <= 5 * 10^4",
    boilerplate: {
      python: {
        functionName: "isAnagram",
        starterCode: "def isAnagram(s, t):\n    # Write your code here\n    pass",
        driverCode: "if __name__ == '__main__':\n    import sys\n    lines = sys.stdin.read().splitlines()\n    if len(lines) >= 2:\n        print(str(isAnagram(lines[0].strip(), lines[1].strip())).lower())"
      },
      cpp: {
        functionName: "isAnagram",
        starterCode: "#include <iostream>\n#include <string>\nusing namespace std;\n\nbool isAnagram(string s, string t) {\n    // Write your code here\n    \n}",
        driverCode: "\nint main() {\n    string s, t;\n    if (cin >> s >> t) {\n        cout << (isAnagram(s, t) ? \"true\" : \"false\") << endl;\n    }\n    return 0;\n}"
      },
      java: {
        functionName: "isAnagram",
        starterCode: "    public static boolean isAnagram(String s, String t) {\n        // Write your code here\n        return false;\n    }",
        driverCode: "    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNext()) {\n            String s = sc.next();\n            String t = sc.hasNext() ? sc.next() : \"\";\n            System.out.println(isAnagram(s, t));\n        }\n    }\n}"
      },
      c: {
        functionName: "isAnagram",
        starterCode: "#include <stdbool.h>\n#include <string.h>\n\nbool isAnagram(char * s, char * t) {\n    // Write your code here\n    \n}",
        driverCode: "\n#include <stdio.h>\nint main() {\n    char s[50005], t[50005];\n    if (scanf(\"%s %s\", s, t) == 2) {\n        printf(\"%s\\n\", isAnagram(s, t) ? \"true\" : \"false\");\n    }\n    return 0;\n}"
      }
    },
    testCases: [
      { input: "anagram\nnagaram", expectedOutput: "true", type: "public" },
      { input: "rat\ncar", expectedOutput: "false", type: "public" },
      { input: "a\nab", expectedOutput: "false", type: "hidden" },
      { input: "awesome\nawesome", expectedOutput: "true", type: "hidden" }
    ]
  },
  {
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "Easy",
    topic: "Array",
    tags: ["array", "hashmap"],
    description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.",
    exampleInput: "nums = [2,7,11,15], target = 9",
    exampleOutput: "0 1",
    constraints: "2 <= nums.length <= 10^4",
    boilerplate: {
      python: {
        functionName: "twoSum",
        starterCode: "def twoSum(nums, target):\n    # Write your code here\n    pass",
        driverCode: "if __name__ == '__main__':\n    import sys\n    input_data = sys.stdin.read().split()\n    if input_data:\n        n = int(input_data[0])\n        nums = [int(x) for x in input_data[1:n+1]]\n        target = int(input_data[n+1])\n        result = twoSum(nums, target)\n        print(*(result or []))"
      },
      cpp: {
        functionName: "twoSum",
        starterCode: "#include <iostream>\n#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Write your code here\n    \n}",
        driverCode: "\nint main() {\n    int n, target;\n    if (cin >> n) {\n        vector<int> nums(n);\n        for(int i=0; i<n; i++) cin >> nums[i];\n        cin >> target;\n        vector<int> res = twoSum(nums, target);\n        for(int i=0; i<res.size(); i++) cout << res[i] << (i==res.size()-1 ? \"\" : \" \");\n        cout << endl;\n    }\n    return 0;\n}"
      },
      java: {
        functionName: "twoSum",
        starterCode: "    public static int[] twoSum(int[] nums, int target) {\n        // Write your code here\n        return new int[0];\n    }",
        driverCode: "    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextInt()) {\n            int n = sc.nextInt();\n            int[] nums = new int[n];\n            for(int i=0; i<n; i++) nums[i] = sc.nextInt();\n            int target = sc.nextInt();\n            int[] res = twoSum(nums, target);\n            for(int i=0; i<res.length; i++) {\n                System.out.print(res[i] + (i==res.length-1 ? \"\" : \" \"));\n            }\n        }\n    }\n}"
      },
      c: {
        functionName: "twoSum",
        starterCode: "#include <stdio.h>\n#include <stdlib.h>\n\nvoid twoSum(int* nums, int n, int target) {\n    // Write your code here\n    \n}",
        driverCode: "\nint main() {\n    int n, target;\n    if (scanf(\"%d\", &n) == 1) {\n        int* nums = (int*)malloc(n * sizeof(int));\n        for(int i=0; i<n; i++) scanf(\"%d\", &nums[i]);\n        scanf(\"%d\", &target);\n        twoSum(nums, n, target);\n    }\n    return 0;\n}"
      }
    },
    testCases: [
      { input: "4\n2 7 11 15\n9", expectedOutput: "0 1", type: "public" },
      { input: "3\n3 2 4\n6", expectedOutput: "1 2", type: "public" }
    ]
  }
];

// Reusing the connection logic since it works
const seedDB = async () => {
  try {
    console.log("Connecting...");
    await mongoose.connect(process.env.DATABASE_URL);
    await Problem.deleteMany({});
    await Problem.insertMany(problems);
    console.log("V5 Elite Seeding Successful!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedDB();
