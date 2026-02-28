export interface Phenotype {
  id: string;
  hpoCode: string;
  name: string;
  description: string;
  icon: string;
}

export const PHENOTYPES: Phenotype[] = [
  {
    id: "joint_hypermobility",
    hpoCode: "HP:0001382",
    name: "Joint Hypermobility",
    description: "How much do flexible/unstable joints affect your daily activities?",
    icon: "🦴",
  },
  {
    id: "orthostatic_intolerance",
    hpoCode: "HP:0001250",
    name: "Orthostatic Intolerance",
    description: "How severe is your dizziness or lightheadedness when standing?",
    icon: "🌀",
  },
  {
    id: "post_exertional_malaise",
    hpoCode: "HP:0012531",
    name: "Post-Exertional Malaise",
    description: "How much does physical or mental effort cause delayed fatigue or crashes?",
    icon: "⚡",
  },
  {
    id: "sensory_hypersensitivity",
    hpoCode: "HP:0000822",
    name: "Sensory Hypersensitivity",
    description: "How severely does light, sound, or other stimuli affect you?",
    icon: "👁️",
  },
  {
    id: "chronic_pain",
    hpoCode: "HP:0012532",
    name: "Chronic Pain",
    description: "What is your average daily pain level?",
    icon: "🔥",
  },
];
