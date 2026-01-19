// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'sales' | 'manager' | 'admin';
  title?: UserTitle;
  copperId?: string;
  photoUrl?: string;
  passwordChanged?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserTitle = 
  | 'Sales Representative'
  | 'Sales Manager'
  | 'Director'
  | 'Vice President'
  | 'Executive';

// Goal Types
export interface Goal {
  id: string;
  userId: string;
  type: GoalType;
  period: GoalPeriod;
  target: number;
  current: number;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type GoalType = 
  | 'phone_call_quantity'
  | 'talk_time_minutes'
  | 'email_quantity'
  | 'sms_quantity'
  | 'lead_progression_a'
  | 'lead_progression_b'
  | 'lead_progression_c'
  | 'new_sales_wholesale'
  | 'new_sales_distribution';

export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

// Metric Types
export interface Metric {
  id: string;
  userId: string;
  type: GoalType;
  value: number;
  date: Date;
  source: 'manual' | 'copper' | 'justcall' | 'fishbowl';
  metadata?: Record<string, any>;
  createdAt: Date;
}

// Pipeline Types (from Copper)
export interface PipelineStage {
  id: string;
  name: string;
  pipelineId: string;
  order: number;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

// Dashboard Types
export interface DashboardData {
  user: User;
  goals: Goal[];
  metrics: Metric[];
  teamComparison?: TeamComparison[];
}

export interface TeamComparison {
  userId: string;
  userName: string;
  goalType: GoalType;
  achievement: number;
  rank: number;
}

// Team Member Performance (for leaderboard)
export interface TeamMemberPerformance {
  userId: string;
  userName: string;
  userEmail: string;
  photoUrl?: string;
  totalSales: number;
  phoneCalls: number;
  emails: number;
  leadProgression: number;
  overallScore: number;
  rank: number;
  trend: 'up' | 'down' | 'stable';
}

// Copper Integration Types
export interface CopperContext {
  type: 'person' | 'company' | 'opportunity' | 'lead';
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  customFields?: Record<string, any>;
}

export interface CopperActivity {
  type: 'note' | 'call' | 'meeting' | 'email';
  details: string;
  date: Date;
  parentType: string;
  parentId: string;
}

// Achievement Calculations
export interface Achievement {
  goalId: string;
  percentage: number;
  remaining: number;
  pace: 'ahead' | 'on-track' | 'behind';
  projectedEnd: number;
}

// Settings
export interface UserSettings {
  userId: string;
  notifications: {
    dailyReminder: boolean;
    goalAchieved: boolean;
    weeklyReport: boolean;
  };
  defaultView: 'dashboard' | 'goals' | 'team';
  timezone: string;
}
