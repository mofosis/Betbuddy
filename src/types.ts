export interface UserProfile {
  uid: string;
  displayName: string;
  displayNameLower: string;
  email: string;
  balance: number;
  wins: number;
  losses: number;
  photoURL?: string;
  theme?: 'dark' | 'light' | 'cyber' | 'brutal' | 'midnight' | 'neon' | 'brutal-flat' | 'brutal-dark';
  createdAt?: any;
  politicalOrientation?: string;
  balanceHistory?: { timestamp: any; balance: number }[];
  fcmToken?: string | null;
  lastBetResolvedAt?: any;
  lastChallengeDeductionAt?: any;
}

export type BetStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export type NotificationType = 'invite' | 'update' | 'resolved' | 'bet_invite';

export interface Activity {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  type: 'bet_created' | 'bet_joined' | 'bet_resolved';
  betId: string;
  betTitle: string;
  amount?: number;
  outcomeName?: string;
  createdAt: any;
}

export interface FeatureRequest {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  upvotes: string[]; // Array of user UIDs
  status: 'pending' | 'planned' | 'completed';
  createdAt: any;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  betId?: string;
  requestingUserId?: string;
  read: boolean;
  createdAt: any;
}

export interface BetParticipant {
  uid: string;
  name: string;
  outcomeIndex: number;
  stake: number;
}

export interface Bet {
  id: string;
  creatorId: string;
  creatorName: string;
  title: string;
  description?: string;
  status: BetStatus;
  createdAt: any; // Timestamp
  resolvedAt?: any; // Timestamp
  
  // Multi-outcome/Multi-participant fields
  outcomes: string[]; 
  participants: { [uid: string]: BetParticipant };
  totalPot: number;
  winnerOutcomeIndex?: number | null;
  invitedUserIds?: string[];
  
  // Legacy/Compatibility fields
  amount: number; 
  opponentId?: string | null;
  opponentName?: string | null;
  invitedId?: string | null;
  winnerId?: string | null;
  isUpdated?: boolean;
  updatedAt?: any;
  opponentStake?: number;
}
