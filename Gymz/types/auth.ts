// Gym interface — represents a registered gym on the platform
export interface Gym {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  location?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  eventsEnabled: boolean;
  sponsorBannersEnabled: boolean;
  city?: string | null;
  status: string;
  onboardedAt?: string | null;
  createdAt?: string | null;
}

export interface User {
  id: string;
  uniqueId?: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  role: string;                             // 'member' | 'admin' | 'staff' | 'platform_admin'
  avatarUrl?: string | null;
  phone?: string | null;
  goal?: string | null;
  membershipStatus?: string | null;
  status?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  dob?: string | null;
  height?: number | null;
  weight?: number | null;
  age?: number | null;
  targetWeight?: number | null;
  recommendedWeight?: number | null;
  goalTimeframe?: string | null;
  createdAt?: string | null;
  membershipType?: string | null;
  workoutIntensity?: 'low' | 'moderate' | 'high' | 'extreme' | null;
  weightLost?: number | null;
  renewalDueDate?: string | null;
  calculatedBmi?: number | string | null;
  lastRecordedSteps?: number | null;
  // ── Calibration Flag ─────────────────────────────────────
  isCalibrated: boolean;
  // ── Multi-tenant fields (Phase 1) ──────────────────────────
  gymId?: string | null;                   // Which gym this user belongs to
  gymUniqueId?: string | null;            // e.g. 'SFG-00042'
  accessMode?: 'gym_access' | 'event_access' | null;
  crmTag?: 'event_only' | 'gym_member' | 'converted' | null;
  metadata?: any;
}

export interface AuthContextProps {
  user: User | null;
  loading: boolean;
  login: (user: User) => Promise<void>;
  logout: () => void;
  deleteAccount: () => Promise<{ success: boolean; message: string }>;
  beginAuthOperation: () => void;
  endAuthOperation: () => void;
  refreshUser: () => Promise<void>;
  mergeUserData: (partial: Partial<User>) => void;
  triggerApprovalReset: () => void;  // Call when approved to force navigation remount
  approvalResetTrigger: number;      // Used in navKey to force remount
  refreshUserWithDiagnostics: () => Promise<{
    success: boolean;
    error?: string;
    profile?: User;
    rawProfile?: any;
    rawSub?: any;
    profileErr?: any;
    subErr?: any;
  }>;
  // ── Existing computed flags (unchanged) ───────────────────
  isAdmin: boolean;
  isMember: boolean;
  isActiveMember: boolean;
  isPendingRejected: boolean;
  isCalibrated: boolean;
  // ── New computed flags (Phase 1) ──────────────────────────
  isGymMember: boolean;       // access_mode === 'gym_access'
  isEventMember: boolean;     // access_mode === 'event_access'
  isPlatformAdmin: boolean;   // role === 'platform_admin'
  currentGym: Gym | null;     // The gym this user belongs to
  // ── Security gates (Phase 2) ──────────────────────────────
  hasGymMapping: boolean;     // gymId + accessMode both set
  hasValidMemberId: boolean;  // uniqueId is non-empty
  isApprovedForCalibration: boolean;  // gym_access: admin approved; event_access: always true
  isFullyOnboarded: boolean;  // all gates pass
}
