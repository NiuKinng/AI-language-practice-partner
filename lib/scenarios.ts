import type { Scenario, ScenarioId } from "@/lib/types";

export const scenarios: Scenario[] = [
  {
    id: "interview",
    title: "面试",
    titleEn: "Job Interview",
    role: "AI 扮演一位专业但友好的招聘经理，围绕候选人的经历、动机和岗位匹配度追问。",
    goal: "清晰介绍背景，回答行为面试问题，并用自然英语表达优势与职业目标。",
    difficulty: "intermediate",
    durationMinutes: 8,
    keyExpressions: [
      "I led a project that...",
      "One challenge I faced was...",
      "I am particularly interested in this role because...",
    ],
    successCriteria: [
      "能用 STAR 结构回答至少一个问题",
      "能解释过往经验与岗位要求的关联",
      "回答中停顿可控，表达完整",
    ],
    openingLine:
      "Thanks for joining today. Could you start by telling me a little about yourself and what attracted you to this role?",
  },
  {
    id: "restaurant",
    title: "点餐",
    titleEn: "Ordering Food",
    role: "AI 扮演餐厅服务员，帮助用户点餐、询问偏好、处理缺货或推荐菜品。",
    goal: "自然完成点餐、询问食材、表达忌口和确认订单。",
    difficulty: "beginner",
    durationMinutes: 5,
    keyExpressions: [
      "Could I have...",
      "Does this contain...",
      "What would you recommend?",
    ],
    successCriteria: [
      "能点至少一道主菜和饮品",
      "能询问推荐或食材",
      "能确认订单与特殊要求",
    ],
    openingLine:
      "Welcome in. Are you ready to order, or would you like a recommendation first?",
  },
  {
    id: "meeting",
    title: "会议",
    titleEn: "Team Meeting",
    role: "AI 扮演跨职能会议主持人，要求用户同步进展、提出阻塞并协商下一步。",
    goal: "在会议中清晰汇报进展、提出问题、确认行动项。",
    difficulty: "advanced",
    durationMinutes: 10,
    keyExpressions: [
      "Here is a quick update on...",
      "The main blocker is...",
      "Could we align on the next step?",
    ],
    successCriteria: [
      "能简洁汇报进展",
      "能说明阻塞与风险",
      "能确认明确行动项和负责人",
    ],
    openingLine:
      "Let's start with your update. What progress have you made since our last meeting, and is anything blocking you?",
  },
];

export function getScenario(id: ScenarioId) {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
}

export function buildScenarioInstructions(scenario: Scenario, level: string) {
  return [
    "You are an English speaking practice partner.",
    "Keep the conversation realistic and natural. Do not over-explain teaching concepts during the roleplay.",
    "Only correct the learner during the conversation if their wording prevents understanding. Otherwise, save corrections for the post-session report.",
    `Scenario: ${scenario.titleEn}`,
    `Role: ${scenario.role}`,
    `Learner goal: ${scenario.goal}`,
    `Learner level: ${level}`,
    `Success criteria: ${scenario.successCriteria.join("; ")}`,
    `Open the conversation with: "${scenario.openingLine}"`,
    "Speak in English. Keep turns concise enough for spoken conversation.",
  ].join("\n");
}
