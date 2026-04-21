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
  createdAt?: string;
  isAdmin?: boolean;
  lastBetResolvedAt?: string | null;
  lastChallengeDeductionAt?: number | null;
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
  createdAt: string;
}

export interface FeatureRequest {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  upvotes: string[];
  status: 'pending' | 'planned' | 'completed';
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  betId?: string;
  read: boolean;
  createdAt: string;
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
  createdAt: string;
  resolvedAt?: string;
  updatedAt?: string;
  outcomes: string[];
  participants: { [uid: string]: BetParticipant };
  totalPot: number;
  winnerOutcomeIndex?: number | null;
  invitedUserIds?: string[];
  amount: number;
}
