import Joi from 'joi';

const anamnesisFieldSchema = Joi.string().allow('').optional();

export const patientAnamnesisBodySchema = Joi.object({
  chiefComplaint: anamnesisFieldSchema,
  currentHistory: anamnesisFieldSchema,
  personalHistory: anamnesisFieldSchema,
  familyHistory: anamnesisFieldSchema,
  socialHistory: anamnesisFieldSchema,
  medicalPsychiatricHistory: anamnesisFieldSchema,
  lifeHabits: anamnesisFieldSchema,
  emotionalBehavioral: anamnesisFieldSchema,
  therapeuticGoals: anamnesisFieldSchema,
  psychologistNotes: anamnesisFieldSchema,
}).unknown(false);
