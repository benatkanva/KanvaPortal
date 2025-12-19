import { 
    db, 
    collections, 
    serverTimestamp, 
    Timestamp,
    createConverter,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    Unsubscribe,
    startAt,
    endAt
  } from './db';

  import { User, Goal, Metric, GoalPeriod, GoalType } from '@/types';
  import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';
  
  // User Services
  export const userService = {
    // Get user by ID
    async getUser(userId: string): Promise<User | null> {
      try {
        const userDoc = await getDoc(
          doc(db, collections.users, userId).withConverter(createConverter<User>())
        );
        return userDoc.exists() ? userDoc.data() : null;
      } catch (error) {
        console.error('Error fetching user:', error);
        // Dev fallback: allow dashboard to render without Firestore when developing locally
        if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
          console.warn('[DEV_MODE] Using mock user due to Firestore permissions.');
          const mockUser: User = {
            id: userId,
            name: 'Sales Representative',
            email: 'user@example.com',
            role: 'rep',
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any;
          return mockUser;
        }
        return null;
      }
    },
  
    // Get all users (for team view)
    async getAllUsers(): Promise<User[]> {
      try {
        const q = query(
          collection(db, collections.users).withConverter(createConverter<User>()),
          orderBy('name')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data());
      } catch (error) {
        console.error('Error fetching users:', error);
        return [];
      }
    },
  
    // Update user
    async updateUser(userId: string, data: Partial<User>): Promise<void> {
      try {
        await updateDoc(doc(db, collections.users, userId), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating user:', error);
        throw error;
      }
    },
  
    // Subscribe to user changes
    subscribeToUser(userId: string, callback: (user: User | null) => void): Unsubscribe {
      return onSnapshot(
        doc(db, collections.users, userId).withConverter(createConverter<User>()),
        (doc) => {
          callback(doc.exists() ? doc.data() : null);
        }
      );
    }
  };

  // Settings Services (per-user app settings)
  export const settingsService = {
    async getSettings(userId: string): Promise<Record<string, any> | null> {
      try {
        const ref = doc(db, collections.settings, userId);
        const snap = await getDoc(ref);
        return snap.exists() ? (snap.data() as any) : null;
      } catch (error) {
        console.error('Error fetching settings:', error);
        return null;
      }
    },

    async updateSettings(userId: string, data: Record<string, any>): Promise<void> {
      try {
        await setDoc(doc(db, collections.settings, userId), {
          ...data,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (error) {
        console.error('Error updating settings:', error);
        throw error;
      }
    },

    // Team goals live in a single shared document
    async getTeamGoals(): Promise<Record<string, any> | null> {
      try {
        const ref = doc(db, collections.settings, 'team_goals');
        const snap = await getDoc(ref);
        return snap.exists() ? (snap.data() as any) : null;
      } catch (error) {
        console.error('Error fetching team goals:', error);
        return null;
      }
    },

    async updateTeamGoals(data: Record<string, any>): Promise<void> {
      try {
        await setDoc(doc(db, collections.settings, 'team_goals'), {
          ...data,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (error) {
        console.error('Error updating team goals:', error);
        throw error;
      }
    },
  };
  
  // Goal Services
  export const goalService = {
    // Create or update goal
    async upsertGoal(goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
      try {
        // Generate ID based on user, type, and period
        const goalId = `${goal.userId}_${goal.type}_${goal.period}`;
        
        await setDoc(doc(db, collections.goals, goalId), {
          ...goal,
          id: goalId,
          startDate: Timestamp.fromDate(goal.startDate),
          endDate: Timestamp.fromDate(goal.endDate),
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp() // Will only set on first creation
        }, { merge: true });
        
        return goalId;
      } catch (error) {
        console.error('Error upserting goal:', error);
        throw error;
      }
    },
  
    // Get user goals for current period
    async getUserGoals(userId: string, period?: GoalPeriod): Promise<Goal[]> {
      try {
        let q = query(
          collection(db, collections.goals).withConverter(createConverter<Goal>()),
          where('userId', '==', userId)
        );
        
        if (period) {
          q = query(q, where('period', '==', period));
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data());
      } catch (error) {
        console.error('Error fetching goals:', error);
        return [];
      }
    },
  
    // Get all goals (for team comparison)
    async getAllGoals(period?: GoalPeriod): Promise<Goal[]> {
      try {
        let q = query(
          collection(db, collections.goals).withConverter(createConverter<Goal>()),
          orderBy('userId')
        );
        
        if (period) {
          q = query(q, where('period', '==', period));
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data());
      } catch (error) {
        console.error('Error fetching all goals:', error);
        return [];
      }
    },
  
    // Subscribe to goals
    subscribeToGoals(userId: string, callback: (goals: Goal[]) => void): Unsubscribe {
      const q = query(
        collection(db, collections.goals).withConverter(createConverter<Goal>()),
        where('userId', '==', userId)
      );
      
      return onSnapshot(q, (snapshot) => {
        const goals = snapshot.docs.map(doc => doc.data());
        callback(goals);
      });
    }
  };
  
  // Metric Services
  export const metricService = {
    // Log a metric
    async logMetric(metric: Omit<Metric, 'id' | 'createdAt'>): Promise<string> {
      try {
        const metricRef = doc(collection(db, collections.metrics));
        await setDoc(metricRef, {
          ...metric,
          id: metricRef.id,
          date: Timestamp.fromDate(metric.date),
          createdAt: serverTimestamp()
        });
        return metricRef.id;
      } catch (error) {
        console.error('Error logging metric:', error);
        throw error;
      }
    },
  
    // Get metrics for date range
    async getMetrics(
      userId: string, 
      type: GoalType, 
      startDate: Date, 
      endDate: Date
    ): Promise<Metric[]> {
      try {
        const q = query(
          collection(db, collections.metrics).withConverter(createConverter<Metric>()),
          where('userId', '==', userId),
          where('type', '==', type),
          where('date', '>=', Timestamp.fromDate(startDate)),
          where('date', '<=', Timestamp.fromDate(endDate)),
          orderBy('date', 'desc')
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data());
      } catch (error) {
        console.error('Error fetching metrics:', error);
        return [];
      }
    },
  
    // Get metrics for period (helper function)
    async getMetricsForPeriod(
      userId: string,
      type: GoalType,
      period: GoalPeriod
    ): Promise<Metric[]> {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;
  
      switch (period) {
        case 'daily':
          startDate = startOfDay(now);
          endDate = endOfDay(now);
          break;
        case 'weekly':
          startDate = startOfWeek(now, { weekStartsOn: 1 });
          endDate = endOfWeek(now, { weekStartsOn: 1 });
          break;
        case 'monthly':
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case 'quarterly':
          startDate = startOfQuarter(now);
          endDate = endOfQuarter(now);
          break;
        default:
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
      }
  
      return this.getMetrics(userId, type, startDate, endDate);
    },
  
    // Subscribe to real-time metrics
    subscribeToMetrics(
      userId: string,
      callback: (metrics: Metric[]) => void
    ): Unsubscribe {
      const q = query(
        collection(db, collections.metrics).withConverter(createConverter<Metric>()),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(100) // Last 100 metrics
      );
      
      return onSnapshot(q, (snapshot) => {
        const metrics = snapshot.docs.map(doc => doc.data());
        callback(metrics);
      });
    },
  
    // Aggregate metrics for team
    async getTeamMetrics(
      type: GoalType,
      period: GoalPeriod
    ): Promise<Map<string, number>> {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;
  
      switch (period) {
        case 'daily':
          startDate = startOfDay(now);
          endDate = endOfDay(now);
          break;
        case 'weekly':
          startDate = startOfWeek(now, { weekStartsOn: 1 });
          endDate = endOfWeek(now, { weekStartsOn: 1 });
          break;
        case 'monthly':
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case 'quarterly':
          startDate = startOfQuarter(now);
          endDate = endOfQuarter(now);
          break;
        default:
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
      }
  
      try {
        const q = query(
          collection(db, collections.metrics).withConverter(createConverter<Metric>()),
          where('type', '==', type),
          where('date', '>=', Timestamp.fromDate(startDate)),
          where('date', '<=', Timestamp.fromDate(endDate))
        );
        
        const snapshot = await getDocs(q);
        const aggregated = new Map<string, number>();
        
        snapshot.docs.forEach(doc => {
          const metric = doc.data();
          const current = aggregated.get(metric.userId) || 0;
          aggregated.set(metric.userId, current + metric.value);
        });
        
        return aggregated;
      } catch (error) {
        console.error('Error fetching team metrics:', error);
        return new Map();
      }
    }
  };