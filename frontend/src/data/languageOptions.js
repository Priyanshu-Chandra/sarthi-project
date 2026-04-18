export const LANGUAGE_OPTIONS = [
  {
    id: 71,
    name: "Python (3.10.0)",
    label: "Python",
    value: "python",
    version: "3.10.0",
  },
  {
    id: 50,
    name: "C (GCC 11.2.0)",
    label: "C",
    value: "c",
    version: "11.2.0",
  },
  {
    id: 54,
    name: "C++ (GCC 11.2.0)",
    label: "C++",
    value: "cpp",
    version: "11.2.0",
  },
  {
    id: 62,
    name: "Java (OpenJDK 17.0.2)",
    label: "Java",
    value: "java",
    version: "17.0.2",
  },
];

export const CODE_SNIPPETS = {
  python: `def greet(name):\n\tprint(f"Hello, {name}!")\n\ngreet("Sarthi User")`,
  c: `#include <stdio.h>\n\nint main() {\n\tprintf("Hello, Sarthi User!\\n");\n\treturn 0;\n}`,
  cpp: `#include <iostream>\n\nint main() {\n\tstd::cout << "Hello, Sarthi User!" << std::endl;\n\treturn 0;\n}`,
  java: `public class Main {\n\tpublic static void main(String[] args) {\n\t\tSystem.out.println("Hello, Sarthi User!");\n\t}\n}`,
};
