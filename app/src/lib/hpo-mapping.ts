/**
 * Human Phenotype Ontology (HPO) Reference Mapping
 * Maps patient-reported symptoms to clinical terminology for RAG.
 */

export interface HPOTerm {
  code: string;
  name: string;
  synonyms: string[];
  category: string;
}

export const HPO_REFERENCE: HPOTerm[] = [
  {
    code: "HP:0012531",
    name: "Post-exertional malaise",
    synonyms: [
      "heavy limbs",
      "crash after activity",
      "delayed fatigue",
      "exhaustion after effort",
      "PEM",
      "energy crash",
      "payback",
      "boom and bust",
    ],
    category: "Fatigue",
  },
  {
    code: "HP:0001250",
    name: "Orthostatic intolerance",
    synonyms: [
      "dizzy when standing",
      "lightheaded",
      "presyncope",
      "POTS symptoms",
      "blood pooling",
      "standing intolerance",
    ],
    category: "Autonomic",
  },
  {
    code: "HP:0001382",
    name: "Joint hypermobility",
    synonyms: [
      "loose joints",
      "subluxation",
      "hypermobile",
      "EDS",
      "joint instability",
      "dislocations",
    ],
    category: "Musculoskeletal",
  },
  {
    code: "HP:0000822",
    name: "Sensory hypersensitivity",
    synonyms: [
      "light sensitivity",
      "sound sensitivity",
      "photophobia",
      "hyperacusis",
      "sensory overload",
      "overstimulated",
    ],
    category: "Neurological",
  },
  {
    code: "HP:0012532",
    name: "Chronic pain",
    synonyms: [
      "widespread pain",
      "constant pain",
      "fibromyalgia",
      "body aches",
      "pain flare",
      "burning pain",
    ],
    category: "Pain",
  },
  {
    code: "HP:0002315",
    name: "Headache",
    synonyms: [
      "migraine",
      "head pain",
      "pressure headache",
      "tension headache",
      "brain fog headache",
    ],
    category: "Neurological",
  },
  {
    code: "HP:0002360",
    name: "Sleep disturbance",
    synonyms: [
      "insomnia",
      "unrefreshing sleep",
      "broken sleep",
      "sleep fragmentation",
      "poor sleep",
      "waking exhausted",
    ],
    category: "Sleep",
  },
  {
    code: "HP:0000739",
    name: "Anxiety",
    synonyms: [
      "nervous",
      "anxious",
      "panic",
      "worry",
      "health anxiety",
      "dread",
    ],
    category: "Psychological",
  },
  {
    code: "HP:0001252",
    name: "Cognitive impairment",
    synonyms: [
      "brain fog",
      "cognitive dysfunction",
      "memory issues",
      "word finding difficulty",
      "can't think clearly",
      "mental fatigue",
    ],
    category: "Cognitive",
  },
  {
    code: "HP:0002027",
    name: "Abdominal pain",
    synonyms: [
      "stomach pain",
      "gut issues",
      "GI distress",
      "nausea",
      "digestive problems",
      "IBS symptoms",
    ],
    category: "Gastrointestinal",
  },
];

/**
 * Format HPO reference as context string for LangChain RAG.
 */
export function getHPOReferenceContext(): string {
  return HPO_REFERENCE.map(
    (term) =>
      `${term.code} — ${term.name} (${term.category})\n  Synonyms: ${term.synonyms.join(", ")}`
  ).join("\n\n");
}
