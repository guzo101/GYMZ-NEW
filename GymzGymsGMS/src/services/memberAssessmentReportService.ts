import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { addBrandedHeader, fetchGymNameForReport } from "@/lib/pdfBranding";

interface MemberAssessmentSnapshot {
  member: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    uniqueId: string | null;
    membershipType: string | null;
    membershipStatus: string | null;
    goal: string | null;
    gymId: string | null;
    heightCm: number | null;
    weightKg: number | null;
    bodyFatPct: number | null;
    age: number | null;
    gender: string | null;
  };
  latestBodyMetric: {
    date: string | null;
    weight: number | null;
    bodyFatPercentage: number | null;
    bodyFatMethod: string | null;
  };
  activeGoal: {
    goalType: string | null;
    dailyCalorieGoal: number | null;
    dailyProteinGoal: number | null;
    dailyFiberGoal: number | null;
    weeklyWorkoutGoal: number | null;
    targetDate: string | null;
  };
  adherence30d: {
    nutritionDaysLogged: number;
    avgProteinPct: number | null;
    avgFiberPct: number | null;
    avgCalorieAlignmentPct: number | null;
    avgSteps: number | null;
    avgSleepHours: number | null;
    totalCheckIns: number;
  };
}

interface AiAssessmentOutput {
  reportTitle: string;
  executiveSummary: string;
  diagnostics: {
    bmi: {
      value: number | null;
      category: string;
      interpretation: string;
      basis: string;
    };
    currentCondition: {
      label: string;
      rationale: string;
      whereUserStands: string;
      targetState: string;
      gapSummary: string;
    };
    bodyMetricsInsights: string[];
  };
  nutritionPlan: {
    dailyCaloriesTarget: {
      value: number;
      rationale: string;
      basis: string;
    };
    macros: {
      protein_g: number;
      carbs_g: number;
      fats_g: number;
      rationale: string;
      basis: string;
    };
    hydration: {
      water_ml: number;
      rationale: string;
      basis: string;
    };
    additionalGuidance: string[];
  };
  improvementAreas: Array<{
    area: string;
    whyItMatters: string;
    recommendation: string;
    criteriaOrGrounds: string;
    priority: "High" | "Medium" | "Low";
  }>;
  actionablePlan: Array<{
    action: string;
    frequency: string;
    measurableTarget: string;
  }>;
  disclaimer: string;
}

function fmtNumber(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `${Number(value).toFixed(1)}${suffix}`;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const direct = Number(trimmed);
    if (Number.isFinite(direct)) return direct;
    const match = trimmed.match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function goalTypeToText(goalType: string | null | undefined): string {
  if (!goalType) return "Not set";
  return goalType.replace(/_/g, " ");
}

function fmtChange(current: number | null | undefined, start: number | null | undefined, suffix = ""): string {
  if (current == null || start == null || Number.isNaN(Number(current)) || Number.isNaN(Number(start))) {
    return "Insufficient data";
  }
  const delta = Number(current) - Number(start);
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}${suffix}`;
}

async function fetchAssessmentSnapshot(memberId: string): Promise<MemberAssessmentSnapshot> {
  const { data: member, error: memberError } = await supabase
    .from("users")
    .select("id, name, email, phone, unique_id, membership_type, membership_status, goal, gym_id, height, weight, body_fat_pct, age, gender")
    .eq("id", memberId)
    .single();
  if (memberError || !member) {
    throw new Error(memberError?.message || "Unable to load member profile.");
  }

  const { data: bodyMetric } = await supabase
    .from("body_metrics")
    .select("date, weight, body_fat_percentage, measurement_method")
    .eq("user_id", memberId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: activeGoal } = await supabase
    .from("user_fitness_goals")
    .select("goal_type, daily_calorie_goal, daily_protein_goal, daily_fiber_goal, weekly_workout_goal, target_date")
    .eq("user_id", memberId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const since30 = format(subMonths(new Date(), 1), "yyyy-MM-dd");

  const { data: calorieRows } = await supabase
    .from("daily_calorie_summary")
    .select("total_calories, total_protein, total_fiber, calorie_goal, protein_goal")
    .eq("user_id", memberId)
    .gte("date", since30);

  const { data: healthRows } = await supabase
    .from("daily_health_logs")
    .select("steps, sleep_minutes")
    .eq("user_id", memberId)
    .gte("date", since30);

  const { count: checkInCount } = await supabase
    .from("attendance_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", memberId)
    .gte("checkin_time", `${since30}T00:00:00.000Z`);

  const nutritionDaysLogged = calorieRows?.length || 0;

  const avgProteinPct =
    calorieRows && calorieRows.length > 0
      ? calorieRows.reduce((sum, row) => {
          const goal = Number(row.protein_goal || activeGoal?.daily_protein_goal || 0);
          if (goal <= 0) return sum;
          return sum + Math.min(100, (Number(row.total_protein || 0) / goal) * 100);
        }, 0) / calorieRows.length
      : null;

  const avgFiberPct =
    calorieRows && calorieRows.length > 0
      ? calorieRows.reduce((sum, row) => {
          const goal = Number(activeGoal?.daily_fiber_goal || 30);
          if (goal <= 0) return sum;
          return sum + Math.min(100, (Number(row.total_fiber || 0) / goal) * 100);
        }, 0) / calorieRows.length
      : null;

  const avgCalorieAlignmentPct =
    calorieRows && calorieRows.length > 0
      ? calorieRows.reduce((sum, row) => {
          const goal = Number(row.calorie_goal || activeGoal?.daily_calorie_goal || 0);
          if (goal <= 0) return sum;
          const intake = Number(row.total_calories || 0);
          const diffPct = Math.abs(intake - goal) / goal;
          return sum + Math.max(0, 100 - diffPct * 100);
        }, 0) / calorieRows.length
      : null;

  const avgSteps =
    healthRows && healthRows.length > 0
      ? healthRows.reduce((sum, row) => sum + Number(row.steps || 0), 0) / healthRows.length
      : null;

  const avgSleepHours =
    healthRows && healthRows.length > 0
      ? healthRows.reduce((sum, row) => sum + Number(row.sleep_minutes || 0), 0) / healthRows.length / 60
      : null;

  const rawHeight = parseOptionalNumber(member.height);
  const normalizedHeightCm =
    rawHeight != null && !Number.isNaN(rawHeight)
      ? rawHeight > 0 && rawHeight < 3
        ? Number((rawHeight * 100).toFixed(1))
        : rawHeight
      : null;

  const profileWeightKg = parseOptionalNumber(member.weight);
  const latestWeightKg = parseOptionalNumber(bodyMetric?.weight);
  // App profile (users.weight) is the live SSOT; body_metrics is historical trend data.
  const resolvedWeightKg = profileWeightKg ?? latestWeightKg;
  // Strict measured-only body-fat: use body_metrics measurements only.
  const resolvedBodyFatPct = parseOptionalNumber(bodyMetric?.body_fat_percentage);

  return {
    member: {
      id: member.id,
      name: member.name || "Member",
      email: member.email || "N/A",
      phone: member.phone || null,
      uniqueId: member.unique_id || null,
      membershipType: member.membership_type || null,
      membershipStatus: member.membership_status || null,
      goal: member.goal || null,
      gymId: member.gym_id || null,
      heightCm: normalizedHeightCm,
      weightKg: profileWeightKg,
      bodyFatPct: null,
      age: parseOptionalNumber(member.age),
      gender: member.gender || null,
    },
    latestBodyMetric: {
      date: bodyMetric?.date || null,
      weight: resolvedWeightKg,
      bodyFatPercentage: resolvedBodyFatPct,
      bodyFatMethod: bodyMetric?.measurement_method || null,
    },
    activeGoal: {
      goalType: activeGoal?.goal_type || null,
      dailyCalorieGoal: activeGoal?.daily_calorie_goal != null ? Number(activeGoal.daily_calorie_goal) : null,
      dailyProteinGoal: activeGoal?.daily_protein_goal != null ? Number(activeGoal.daily_protein_goal) : null,
      dailyFiberGoal: activeGoal?.daily_fiber_goal != null ? Number(activeGoal.daily_fiber_goal) : null,
      weeklyWorkoutGoal: activeGoal?.weekly_workout_goal != null ? Number(activeGoal.weekly_workout_goal) : null,
      targetDate: activeGoal?.target_date || null,
    },
    adherence30d: {
      nutritionDaysLogged,
      avgProteinPct,
      avgFiberPct,
      avgCalorieAlignmentPct,
      avgSteps,
      avgSleepHours,
      totalCheckIns: checkInCount || 0,
    },
  };
}

function calculateBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const h = heightCm / 100;
  return Number((weightKg / (h * h)).toFixed(1));
}

// Deurenberg estimate (BMI-based). Used only when measured body-fat is unavailable.
function calculateEstimatedBodyFatPct(
  weightKg: number | null,
  heightCm: number | null,
  age: number | null,
  gender: string | null
): number | null {
  const bmi = calculateBmi(weightKg, heightCm);
  if (bmi == null || age == null || age <= 0 || !gender) return null;
  const g = gender.toLowerCase();
  if (g !== "male" && g !== "female") return null;
  const sex = g === "male" ? 1 : 0;
  const est = 1.2 * bmi + 0.23 * age - 10.8 * sex - 5.4;
  return Number(est.toFixed(1));
}

function cleanJsonReply(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i) || trimmed.match(/```\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  return trimmed;
}

async function generateAIAssessment(snapshot: MemberAssessmentSnapshot): Promise<AiAssessmentOutput> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Authentication required to generate AI assessment report.");
  if (!snapshot.member.gymId) throw new Error("Member gym_id is required to generate AI report.");

  const bmi = calculateBmi(snapshot.latestBodyMetric.weight, snapshot.member.heightCm);
  const normalizedContext = {
    member: snapshot.member,
    onboardingDiagnostics: {
      height_cm: snapshot.member.heightCm,
      age: snapshot.member.age,
      gender: snapshot.member.gender,
      latest_weight_kg: snapshot.latestBodyMetric.weight,
      latest_body_fat_pct: snapshot.latestBodyMetric.bodyFatPercentage,
      bmi,
      goal: snapshot.member.goal,
      goalType: snapshot.activeGoal.goalType,
      activeGoal: snapshot.activeGoal,
      adherence30d: {
        nutritionDaysLogged: snapshot.adherence30d.nutritionDaysLogged,
        avgProteinAdherencePct: snapshot.adherence30d.avgProteinPct,
        avgFiberAdherencePct: snapshot.adherence30d.avgFiberPct,
        avgCalorieAlignmentPct: snapshot.adherence30d.avgCalorieAlignmentPct,
        avgSteps: snapshot.adherence30d.avgSteps,
        avgSleepHours: snapshot.adherence30d.avgSleepHours,
        checkIns30d: snapshot.adherence30d.totalCheckIns,
      },
    },
  };

  const reportSchemaDescription = `Return STRICT JSON only, matching this shape:
{
  "reportTitle": string,
  "executiveSummary": string,
  "diagnostics": {
    "bmi": { "value": number|null, "category": string, "interpretation": string, "basis": string },
    "currentCondition": {
      "label": string,
      "rationale": string,
      "whereUserStands": string,
      "targetState": string,
      "gapSummary": string
    },
    "bodyMetricsInsights": string[]
  },
  "nutritionPlan": {
    "dailyCaloriesTarget": { "value": number, "rationale": string, "basis": string },
    "macros": { "protein_g": number, "carbs_g": number, "fats_g": number, "rationale": string, "basis": string },
    "hydration": { "water_ml": number, "rationale": string, "basis": string },
    "additionalGuidance": string[]
  },
  "improvementAreas": [
    { "area": string, "whyItMatters": string, "recommendation": string, "criteriaOrGrounds": string, "priority": "High"|"Medium"|"Low" }
  ],
  "actionablePlan": [
    { "action": string, "frequency": string, "measurableTarget": string }
  ],
  "disclaimer": string
}`;

  const systemPrompt = `You are an elite onboarding assessment analyst for gyms.
Generate a personalized, data-driven report only from provided diagnostics.
No generic statements. No missing-field inventions.
If a field is missing, explicitly state "Insufficient data for X".
Use clinical and professional language suitable for printing.
Always provide clear basis/grounds for conclusions and recommendations.
${reportSchemaDescription}`;

  const message = `Generate a complete member onboarding assessment report from this data:
${JSON.stringify(normalizedContext, null, 2)}

Mandatory requirements:
1) Include body metrics interpretation (BMI category and grounds).
2) Evaluate current condition (underweight/healthy/overweight/etc) with reasoning.
3) Explain where member stands vs where they need to be.
4) Provide nutrition targets: calories, macros, hydration.
5) Provide key improvement areas, reasons, and actionable steps.
6) Output STRICT JSON only.`;

  const supabaseUrl = (supabase as any).supabaseUrl ?? "https://bivgvttxaymcdnuvyugv.supabase.co";
  const response = await fetch(`${supabaseUrl}/functions/v1/openai-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      user_id: snapshot.member.id,
      gym_id: snapshot.member.gymId,
      feature_type: "AI_CHAT",
      message,
      system_prompt: systemPrompt,
      context_data: normalizedContext,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`AI report generation failed: ${responseText}`);
  }

  const payload = JSON.parse(responseText);
  const reply = payload?.reply;
  if (!reply || typeof reply !== "string") {
    throw new Error("AI response missing reply content.");
  }

  const jsonText = cleanJsonReply(reply);
  let parsed: AiAssessmentOutput;
  try {
    parsed = JSON.parse(jsonText) as AiAssessmentOutput;
  } catch {
    throw new Error("AI response format invalid: expected strict JSON report.");
  }

  if (!parsed.reportTitle || !parsed.diagnostics || !parsed.nutritionPlan || !Array.isArray(parsed.improvementAreas)) {
    throw new Error("AI response JSON missing required report fields.");
  }

  return parsed;
}

export async function generateOnboardingAssessmentPdf(memberId: string, generatedBy = "Admin"): Promise<void> {
  const snapshot = await fetchAssessmentSnapshot(memberId);
  const aiReport = await generateAIAssessment(snapshot);
  const gymName = await fetchGymNameForReport(snapshot.member.gymId);

  const doc = new jsPDF("p", "mm", "a4") as any;
  const startY = addBrandedHeader(
    doc,
    gymName,
    aiReport.reportTitle || "Member Onboarding Assessment",
    "AI-generated personalized onboarding diagnostic report",
    generatedBy
  );

  autoTable(doc, {
    startY: startY + 2,
    head: [["Member", "Email", "Member ID", "Membership", "Status"]],
    body: [[
      snapshot.member.name,
      snapshot.member.email,
      snapshot.member.uniqueId || "N/A",
      snapshot.member.membershipType || "N/A",
      snapshot.member.membershipStatus || "N/A",
    ]],
    theme: "grid",
    headStyles: { fillColor: [42, 75, 42] },
    styles: { fontSize: 9 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable?.finalY + 5 || 92,
    head: [["Executive Summary"]],
    body: [[aiReport.executiveSummary || "Insufficient data for summary."]],
    theme: "striped",
    headStyles: { fillColor: [42, 75, 42] },
    styles: { fontSize: 9 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable?.finalY + 6 || 120,
    head: [["Diagnostic Domain", "Current Evaluation", "Assessment Grounds / Basis"]],
    body: [
      ["Primary Goal", goalTypeToText(snapshot.activeGoal.goalType || snapshot.member.goal), "Onboarding profile goal"],
      ["BMI", aiReport.diagnostics.bmi?.value != null ? String(aiReport.diagnostics.bmi.value) : "N/A", aiReport.diagnostics.bmi?.basis || "N/A"],
      ["BMI Category", aiReport.diagnostics.bmi?.category || "N/A", aiReport.diagnostics.bmi?.interpretation || "N/A"],
      ["Current Condition", aiReport.diagnostics.currentCondition?.label || "N/A", aiReport.diagnostics.currentCondition?.rationale || "N/A"],
      ["Where User Stands", aiReport.diagnostics.currentCondition?.whereUserStands || "N/A", aiReport.diagnostics.currentCondition?.gapSummary || "N/A"],
      ["Target State", aiReport.diagnostics.currentCondition?.targetState || "N/A", "AI diagnostic target state"],
    ],
    theme: "striped",
    headStyles: { fillColor: [42, 75, 42] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: 54 } },
  });

  doc.addPage("p", "a4");
  addBrandedHeader(
    doc,
    gymName,
    "Nutrition Breakdown and Guidance",
    "AI-tailored targets and rationale",
    generatedBy
  );

  autoTable(doc, {
    startY: 58,
    head: [["Nutrition Component", "Target", "Reasoning", "Criteria/Grounds"]],
    body: [
      [
        "Daily Calories",
        `${aiReport.nutritionPlan.dailyCaloriesTarget?.value ?? 0} kcal/day`,
        aiReport.nutritionPlan.dailyCaloriesTarget?.rationale || "N/A",
        aiReport.nutritionPlan.dailyCaloriesTarget?.basis || "N/A",
      ],
      [
        "Protein / Carbs / Fats",
        `${aiReport.nutritionPlan.macros?.protein_g ?? 0}g / ${aiReport.nutritionPlan.macros?.carbs_g ?? 0}g / ${aiReport.nutritionPlan.macros?.fats_g ?? 0}g`,
        aiReport.nutritionPlan.macros?.rationale || "N/A",
        aiReport.nutritionPlan.macros?.basis || "N/A",
      ],
      [
        "Hydration",
        `${aiReport.nutritionPlan.hydration?.water_ml ?? 0} ml/day`,
        aiReport.nutritionPlan.hydration?.rationale || "N/A",
        aiReport.nutritionPlan.hydration?.basis || "N/A",
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [42, 75, 42], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 35 },
      2: { cellWidth: 56 },
      3: { cellWidth: 56 },
    },
  });

  if (aiReport.nutritionPlan.additionalGuidance?.length) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable?.finalY + 5 || 120,
      head: [["Additional Nutrition Guidance"]],
      body: aiReport.nutritionPlan.additionalGuidance.map((line) => [line]),
      theme: "striped",
      headStyles: { fillColor: [42, 75, 42] },
      styles: { fontSize: 8.5 },
    });
  }

  doc.addPage("p", "a4");
  addBrandedHeader(
    doc,
    gymName,
    "Improvement Plan",
    "AI-identified priorities with actionable guidance",
    generatedBy
  );

  autoTable(doc, {
    startY: 58,
    head: [["Area", "Priority", "Why It Matters", "Recommendation", "Criteria/Grounds"]],
    body: (aiReport.improvementAreas || []).map((row) => [
      row.area || "N/A",
      row.priority || "N/A",
      row.whyItMatters || "N/A",
      row.recommendation || "N/A",
      row.criteriaOrGrounds || "N/A",
    ]),
    theme: "grid",
    headStyles: { fillColor: [42, 75, 42], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 18 },
      2: { cellWidth: 44 },
      3: { cellWidth: 44 },
      4: { cellWidth: 44 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable?.finalY + 6 || 180,
    head: [["Action", "Frequency", "Measurable Target"]],
    body: (aiReport.actionablePlan || []).map((a) => [
      a.action || "N/A",
      a.frequency || "N/A",
      a.measurableTarget || "N/A",
    ]),
    theme: "striped",
    headStyles: { fillColor: [42, 75, 42] },
    styles: { fontSize: 8.5 },
    columnStyles: { 0: { cellWidth: 72 }, 1: { cellWidth: 34 }, 2: { cellWidth: 72 } },
  });

  if (aiReport.disclaimer) {
    const y = ((doc as any).lastAutoTable?.finalY || 250) + 8;
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(aiReport.disclaimer, 15, Math.min(y, 285), { maxWidth: 180 });
  }

  const safeName = snapshot.member.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Onboarding_Assessment_${safeName}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}

export async function generateMonthlyProgressPdf(memberId: string, generatedBy = "Admin"): Promise<void> {
  const snapshot = await fetchAssessmentSnapshot(memberId);
  const gymName = await fetchGymNameForReport(snapshot.member.gymId);
  const reportMonth = subMonths(new Date(), 1);
  const monthStart = format(startOfMonth(reportMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(reportMonth), "yyyy-MM-dd");

  const { data: monthCalories } = await supabase
    .from("daily_calorie_summary")
    .select("total_calories, total_protein, total_fiber")
    .eq("user_id", memberId)
    .gte("date", monthStart)
    .lte("date", monthEnd);

  const { data: nutritionLogs } = await supabase
    .from("daily_nutrition_logs")
    .select("logged_at, calories, protein")
    .eq("user_id", memberId)
    .gte("logged_at", `${monthStart}T00:00:00.000Z`)
    .lte("logged_at", `${monthEnd}T23:59:59.999Z`);

  const { data: monthHealth } = await supabase
    .from("daily_health_logs")
    .select("steps, sleep_minutes")
    .eq("user_id", memberId)
    .gte("date", monthStart)
    .lte("date", monthEnd);

  const { count: monthCheckins } = await supabase
    .from("attendance_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", memberId)
    .gte("checkin_time", `${monthStart}T00:00:00.000Z`)
    .lte("checkin_time", `${monthEnd}T23:59:59.999Z`);

  const avgMonthSteps =
    monthHealth && monthHealth.length > 0
      ? monthHealth.reduce((sum, row) => sum + Number(row.steps || 0), 0) / monthHealth.length
      : null;
  const avgMonthSleep =
    monthHealth && monthHealth.length > 0
      ? monthHealth.reduce((sum, row) => sum + Number(row.sleep_minutes || 0), 0) / monthHealth.length / 60
      : null;
  const avgMonthCalories =
    monthCalories && monthCalories.length > 0
      ? monthCalories.reduce((sum, row) => sum + Number(row.total_calories || 0), 0) / monthCalories.length
      : null;
  const avgMonthProtein =
    monthCalories && monthCalories.length > 0
      ? monthCalories.reduce((sum, row) => sum + Number(row.total_protein || 0), 0) / monthCalories.length
      : null;

  const { data: monthStartMetric } = await supabase
    .from("body_metrics")
    .select("date, weight, body_fat_percentage, measurement_method")
    .eq("user_id", memberId)
    .gte("date", monthStart)
    .lte("date", monthEnd)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: monthEndMetric } = await supabase
    .from("body_metrics")
    .select("date, weight, body_fat_percentage, measurement_method")
    .eq("user_id", memberId)
    .gte("date", monthStart)
    .lte("date", monthEnd)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestOverallMetric } = await supabase
    .from("body_metrics")
    .select("date, weight, body_fat_percentage, measurement_method")
    .eq("user_id", memberId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: baselineBeforeMonthMetric } = await supabase
    .from("body_metrics")
    .select("date, weight, body_fat_percentage, measurement_method")
    .eq("user_id", memberId)
    .lt("date", monthStart)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: absoluteStartMetric } = await supabase
    .from("body_metrics")
    .select("date, weight, body_fat_percentage, measurement_method")
    .eq("user_id", memberId)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: goalForMonth } = await supabase
    .from("user_fitness_goals")
    .select("goal_type, target_weight, starting_weight, starting_body_fat, starting_date, daily_calorie_goal, daily_protein_goal")
    .eq("user_id", memberId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const hasCalorieSummaryRows = (monthCalories?.length || 0) > 0;
  const nutritionDayMap = new Map<string, { calories: number; protein: number }>();
  for (const row of nutritionLogs || []) {
    const ts = String((row as any).logged_at || "");
    const day = ts.includes("T") ? ts.split("T")[0] : ts;
    if (!day) continue;
    const prev = nutritionDayMap.get(day) || { calories: 0, protein: 0 };
    prev.calories += Number((row as any).calories || 0);
    prev.protein += Number((row as any).protein || 0);
    nutritionDayMap.set(day, prev);
  }
  const nutritionDaysFromLogs = nutritionDayMap.size;
  const avgCaloriesFromLogs = nutritionDaysFromLogs > 0
    ? Array.from(nutritionDayMap.values()).reduce((sum, d) => sum + d.calories, 0) / nutritionDaysFromLogs
    : null;
  const avgProteinFromLogs = nutritionDaysFromLogs > 0
    ? Array.from(nutritionDayMap.values()).reduce((sum, d) => sum + d.protein, 0) / nutritionDaysFromLogs
    : null;

  const resolvedAvgMonthCalories = hasCalorieSummaryRows ? avgMonthCalories : avgCaloriesFromLogs;
  const resolvedAvgMonthProtein = hasCalorieSummaryRows ? avgMonthProtein : avgProteinFromLogs;

  // Start baseline precedence (fact-based, source-labeled):
  // 1) first weight inside report month
  // 2) latest weight before month start
  // 3) configured goal starting_weight
  // 4) earliest-ever body_metrics weight
  const startWeight = monthStartMetric?.weight != null
    ? Number(monthStartMetric.weight)
    : baselineBeforeMonthMetric?.weight != null
      ? Number(baselineBeforeMonthMetric.weight)
      : goalForMonth?.starting_weight != null
        ? Number(goalForMonth.starting_weight)
        : absoluteStartMetric?.weight != null
          ? Number(absoluteStartMetric.weight)
          : null;
  const startWeightSource = monthStartMetric?.weight != null
    ? "month first log"
    : baselineBeforeMonthMetric?.weight != null
      ? "pre-month latest log"
      : goalForMonth?.starting_weight != null
        ? "goal starting weight"
        : absoluteStartMetric?.weight != null
          ? "earliest metric log"
          : null;
  const monthEndWeight = monthEndMetric?.weight != null
    ? Number(monthEndMetric.weight)
    : null;
  const weightCandidates = {
    latestOverall:
      snapshot.member.weightKg != null
        ? Number(snapshot.member.weightKg)
        : latestOverallMetric?.weight != null
          ? Number(latestOverallMetric.weight)
          : snapshot.latestBodyMetric.weight,
    profileCurrent:
      snapshot.member.weightKg != null
        ? Number(snapshot.member.weightKg)
        : latestOverallMetric?.weight != null
          ? Number(latestOverallMetric.weight)
          : null,
  };
  const latestOverallWeight = weightCandidates.latestOverall;
  const profileCurrentWeight = weightCandidates.profileCurrent;
  const currentWeight = profileCurrentWeight ?? monthEndWeight ?? latestOverallWeight ?? null;
  const startBodyFat = monthStartMetric?.body_fat_percentage != null
    ? Number(monthStartMetric.body_fat_percentage)
    : baselineBeforeMonthMetric?.body_fat_percentage != null
      ? Number(baselineBeforeMonthMetric.body_fat_percentage)
      : absoluteStartMetric?.body_fat_percentage != null
        ? Number(absoluteStartMetric.body_fat_percentage)
        : null;
  const startBodyFatSource = monthStartMetric?.body_fat_percentage != null
    ? `month first measured log${monthStartMetric?.measurement_method ? ` (${monthStartMetric.measurement_method})` : ""}`
    : baselineBeforeMonthMetric?.body_fat_percentage != null
      ? `pre-month latest measured log${baselineBeforeMonthMetric?.measurement_method ? ` (${baselineBeforeMonthMetric.measurement_method})` : ""}`
      : absoluteStartMetric?.body_fat_percentage != null
        ? `earliest measured log${absoluteStartMetric?.measurement_method ? ` (${absoluteStartMetric.measurement_method})` : ""}`
        : null;
  const monthEndBodyFat = monthEndMetric?.body_fat_percentage != null
    ? Number(monthEndMetric.body_fat_percentage)
    : null;
  const bodyFatCandidates = {
    latestOverall:
      latestOverallMetric?.body_fat_percentage != null
        ? Number(latestOverallMetric.body_fat_percentage)
        : snapshot.latestBodyMetric.bodyFatPercentage,
    profileCurrent: null,
  };
  const latestOverallBodyFat = bodyFatCandidates.latestOverall;
  const profileCurrentBodyFat = bodyFatCandidates.profileCurrent;
  const currentBodyFat = profileCurrentBodyFat ?? monthEndBodyFat ?? latestOverallBodyFat ?? null;

  const estimatedStartBodyFat = calculateEstimatedBodyFatPct(
    startWeight,
    snapshot.member.heightCm,
    snapshot.member.age,
    snapshot.member.gender
  );
  const estimatedCurrentBodyFat = calculateEstimatedBodyFatPct(
    currentWeight,
    snapshot.member.heightCm,
    snapshot.member.age,
    snapshot.member.gender
  );
  const estimatedLatestOverallBodyFat = calculateEstimatedBodyFatPct(
    latestOverallWeight,
    snapshot.member.heightCm,
    snapshot.member.age,
    snapshot.member.gender
  );

  const startBodyFatDisplay = startBodyFat ?? estimatedStartBodyFat;
  const currentBodyFatDisplay = currentBodyFat ?? estimatedCurrentBodyFat;
  const latestOverallBodyFatDisplay = latestOverallBodyFat ?? estimatedLatestOverallBodyFat;

  const startBodyFatDisplaySource = startBodyFat != null
    ? startBodyFatSource
    : estimatedStartBodyFat != null
      ? "estimated (BMI/age/gender)"
      : null;
  const currentBodyFatDisplaySource = monthEndBodyFat != null
    ? `month-end measured${monthEndMetric?.measurement_method ? `, ${monthEndMetric.measurement_method}` : ""}`
    : currentBodyFat != null
      ? `latest measured${latestOverallMetric?.measurement_method ? `, ${latestOverallMetric.measurement_method}` : ""}`
      : estimatedCurrentBodyFat != null
        ? "estimated (BMI/age/gender)"
        : null;

  const monthlyBmi = calculateBmi(currentWeight, snapshot.member.heightCm);
  const latestOverallBmi = calculateBmi(latestOverallWeight, snapshot.member.heightCm);
  const startBmi = calculateBmi(startWeight, snapshot.member.heightCm);

  const avgCaloriesForGoalCheck = Number(resolvedAvgMonthCalories || 0);
  const avgProteinForGoalCheck = Number(resolvedAvgMonthProtein || 0);
  const calorieGoal = goalForMonth?.daily_calorie_goal != null ? Number(goalForMonth.daily_calorie_goal) : snapshot.activeGoal.dailyCalorieGoal;
  const proteinGoal = goalForMonth?.daily_protein_goal != null ? Number(goalForMonth.daily_protein_goal) : snapshot.activeGoal.dailyProteinGoal;

  const calorieAdherence = calorieGoal && calorieGoal > 0
    ? Math.max(0, 100 - (Math.abs(avgCaloriesForGoalCheck - calorieGoal) / calorieGoal) * 100)
    : null;
  const proteinAdherence = proteinGoal && proteinGoal > 0
    ? Math.min(100, (avgProteinForGoalCheck / proteinGoal) * 100)
    : null;

  const memberFirstName = (snapshot.member.name || "Member").split(" ")[0];
  const goalText = goalTypeToText(goalForMonth?.goal_type || snapshot.activeGoal.goalType || snapshot.member.goal).toLowerCase();
  const monthlyNarrative = [
    `Hi ${memberFirstName}, this is your ${format(reportMonth, "MMMM yyyy")} progress report.`,
    `Your primary focus remains ${goalText}. During this period, you logged ${monthCheckins || 0} gym check-ins and ${Math.max(monthCalories?.length || 0, nutritionDaysFromLogs)} nutrition days.`,
    `Your weight moved from ${startWeight != null ? `${startWeight.toFixed(1)} kg` : "insufficient start data"} to ${currentWeight != null ? `${currentWeight.toFixed(1)} kg` : "no current weight available"} (${fmtChange(currentWeight, startWeight, " kg")}).`,
    `${startWeightSource ? `Start-weight source: ${startWeightSource}.` : "Start-weight source not available."}`,
    `Your latest recorded weight overall is ${latestOverallWeight != null ? `${latestOverallWeight.toFixed(1)} kg` : "not available"}${latestOverallMetric?.date ? ` (logged on ${latestOverallMetric.date})` : ""}.`,
    `Your current app profile weight is ${profileCurrentWeight != null ? `${profileCurrentWeight.toFixed(1)} kg` : "not available"}.`,
    `Based on recorded activity, your average daily calories were ${resolvedAvgMonthCalories != null ? `${resolvedAvgMonthCalories.toFixed(0)} kcal` : "not available"} and protein was ${resolvedAvgMonthProtein != null ? `${resolvedAvgMonthProtein.toFixed(0)} g` : "not available"}.`,
  ].join(" ");

  const coachNote = [
    `For next month, prioritize consistency in nutrition logging and weekly training.`,
    `Aim to keep calorie alignment near target and protein intake stable so body composition progress remains measurable.`,
    `If weight or body-fat entries are missing in any week, add at least one body metric check-in so your progress trend stays clinically trackable.`,
  ].join(" ");

  const doc = new jsPDF("p", "mm", "a4") as any;
  addBrandedHeader(
    doc,
    gymName,
    "Member Monthly Progress Report",
    `${format(reportMonth, "MMMM yyyy")} progress snapshot`,
    generatedBy
  );

  autoTable(doc, {
    startY: 58,
    head: [["Member", "Goal", "Month", "Check-ins"]],
    body: [[
      snapshot.member.name,
      goalTypeToText(snapshot.activeGoal.goalType || snapshot.member.goal),
      format(reportMonth, "MMMM yyyy"),
      String(monthCheckins || 0),
    ]],
    theme: "grid",
    headStyles: { fillColor: [42, 75, 42] },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable?.finalY + 6 || 95,
    head: [["Monthly Member Brief"]],
    body: [[monthlyNarrative]],
    theme: "striped",
    headStyles: { fillColor: [42, 75, 42] },
    styles: { fontSize: 9 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable?.finalY + 6 || 120,
    head: [["Domain", "Start of Month", "Current / End of Month", "Change"]],
    body: [
      [
        "Weight",
        startWeight != null
          ? startWeightSource
            ? `${fmtNumber(startWeight, " kg")} (${startWeightSource})`
            : fmtNumber(startWeight, " kg")
          : "N/A",
        profileCurrentWeight != null
          ? `${fmtNumber(profileCurrentWeight, " kg")} (app profile SSOT)`
          : monthEndWeight != null
            ? `${fmtNumber(monthEndWeight, " kg")} (month-end log)`
            : currentWeight != null
              ? `${fmtNumber(currentWeight, " kg")} (latest overall)`
              : "N/A",
        fmtChange(currentWeight, startWeight, " kg")
      ],
      [
        "BMI",
        startBmi != null
          ? startWeightSource
            ? `${fmtNumber(startBmi)} (${startWeightSource})`
            : fmtNumber(startBmi)
          : "N/A",
        profileCurrentWeight != null
          ? `${fmtNumber(monthlyBmi)} (app profile SSOT)`
          : monthEndWeight != null
            ? fmtNumber(monthlyBmi)
            : latestOverallBmi != null
              ? `${fmtNumber(latestOverallBmi)} (latest overall)`
              : "N/A",
        fmtChange(monthlyBmi, startBmi)
      ],
      [
        "Body Fat %",
        startBodyFatDisplay != null
          ? startBodyFatDisplaySource
            ? `${fmtNumber(startBodyFatDisplay, "%")} (${startBodyFatDisplaySource})`
            : fmtNumber(startBodyFatDisplay, "%")
          : "N/A",
        currentBodyFatDisplay != null
          ? currentBodyFatDisplaySource
            ? `${fmtNumber(currentBodyFatDisplay, "%")} (${currentBodyFatDisplaySource})`
            : fmtNumber(currentBodyFatDisplay, "%")
            : "N/A - no measured body-fat log",
        fmtChange(currentBodyFatDisplay, startBodyFatDisplay, "%")
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [42, 75, 42] },
    styles: { fontSize: 8.8 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable?.finalY + 6 || 150,
    head: [["Progress Metric", "Monthly Average", "Reference"]],
    body: [
      ["Calories", fmtNumber(resolvedAvgMonthCalories), String(snapshot.activeGoal.dailyCalorieGoal || "N/A")],
      ["Protein (g)", fmtNumber(resolvedAvgMonthProtein), String(snapshot.activeGoal.dailyProteinGoal || "N/A")],
      ["Steps", fmtNumber(avgMonthSteps), ">= 6,000"],
      ["Sleep (hours)", fmtNumber(avgMonthSleep), ">= 7.0"],
      ["Height", fmtNumber(snapshot.member.heightCm, " cm"), "Onboarding profile metric"],
      ["Body Weight", fmtNumber(currentWeight, " kg"), profileCurrentWeight != null ? "Current app profile SSOT" : "Latest available weight"],
      ["BMI", fmtNumber(monthlyBmi), "Calculated from current profile weight and profile height"],
      ["Body Fat %", fmtNumber(currentBodyFatDisplay, "%"), currentBodyFatDisplaySource || "No measured/estimated body-fat available"],
      [
        "Latest Weight (overall)",
        fmtNumber(latestOverallWeight, " kg"),
        snapshot.member.weightKg != null
          ? "Current app profile SSOT"
          : latestOverallMetric?.date
            ? `Logged on ${latestOverallMetric.date}`
            : "No log date available"
      ],
      ["Latest BMI (overall)", fmtNumber(latestOverallBmi), "Calculated from latest overall weight and profile height"],
      [
        "Latest Body Fat % (overall)",
        fmtNumber(latestOverallBodyFatDisplay, "%"),
        latestOverallBodyFat != null
          ? (latestOverallMetric?.date
              ? `Measured on ${latestOverallMetric.date}${latestOverallMetric?.measurement_method ? ` via ${latestOverallMetric.measurement_method}` : ""}`
              : "Measured body-fat available")
          : estimatedLatestOverallBodyFat != null
            ? "Estimated (BMI/age/gender)"
            : "No measured/estimated body-fat available"
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: [42, 75, 42] },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable?.finalY + 6 || 232,
    head: [["Target Attainment", "Current Status"]],
    body: [
      ["Calorie target alignment", calorieAdherence != null ? `${calorieAdherence.toFixed(0)}%` : "Insufficient data"],
      ["Protein target alignment", proteinAdherence != null ? `${proteinAdherence.toFixed(0)}%` : "Insufficient data"],
      ["Check-in consistency", `${monthCheckins || 0} check-ins this month`],
      ["Nutrition consistency", `${Math.max(monthCalories?.length || 0, nutritionDaysFromLogs)} logged days this month`],
    ],
    theme: "grid",
    headStyles: { fillColor: [42, 75, 42] },
    styles: { fontSize: 8.5 },
  });

  const noteY = ((doc as any).lastAutoTable?.finalY || 260) + 8;
  doc.setFontSize(9);
  doc.setTextColor(45, 45, 45);
  const noteLines = doc.splitTextToSize(`Coach note to you: ${coachNote}`, 180);
  doc.text(noteLines, 15, Math.min(noteY, 285));

  const safeName = snapshot.member.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Monthly_Progress_${safeName}_${format(reportMonth, "yyyy_MM")}.pdf`);
}
