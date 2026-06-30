#![forbid(unsafe_code)]

use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SessionId(u64);

impl SessionId {
    pub fn raw(self) -> u64 {
        self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct JobId(u64);

impl JobId {
    pub fn raw(self) -> u64 {
        self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Wallet(String);

impl Wallet {
    pub fn parse(value: impl Into<String>) -> Result<Self, RejectReason> {
        let value = value.into();
        if value.trim().is_empty() {
            return Err(RejectReason::UnauthorizedWallet);
        }
        Ok(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkerName(String);

impl WorkerName {
    pub fn new(value: impl Into<String>) -> Self {
        let value = value.into();
        let value = value.trim();
        if value.is_empty() {
            return Self("worker".to_string());
        }
        Self(value.to_string())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Hash32([u8; 32]);

impl Hash32 {
    pub fn zero() -> Self {
        Self([0; 32])
    }

    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MinerSession {
    pub id: SessionId,
    pub wallet: Wallet,
    pub worker: WorkerName,
    pub difficulty: u64,
    pub active_job: Option<JobId>,
    pub accepted_shares: u64,
    pub rejected_shares: u64,
}

impl MinerSession {
    pub fn new(id: SessionId, wallet: Wallet, worker: WorkerName, difficulty: u64) -> Self {
        Self {
            id,
            wallet,
            worker,
            difficulty: difficulty.max(1),
            active_job: None,
            accepted_shares: 0,
            rejected_shares: 0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MiningJob {
    pub id: JobId,
    pub height: u64,
    pub required_difficulty: u64,
    pub seed_hash: Hash32,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ShareKey {
    pub session_id: SessionId,
    pub job_id: JobId,
    pub nonce: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShareSubmit {
    pub session_id: SessionId,
    pub job_id: JobId,
    pub nonce: u64,
    pub share_difficulty: u64,
    pub result_hash: Hash32,
}

impl ShareSubmit {
    fn key(&self) -> ShareKey {
        ShareKey {
            session_id: self.session_id,
            job_id: self.job_id,
            nonce: self.nonce,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AcceptedShare {
    pub session_id: SessionId,
    pub job_id: JobId,
    pub credited_difficulty: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RejectedShare {
    pub session_id: Option<SessionId>,
    pub job_id: Option<JobId>,
    pub reason: RejectReason,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShareResult {
    Accepted(AcceptedShare),
    Rejected(RejectedShare),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RejectReason {
    UnknownSession,
    StaleJob,
    LowDifficulty { required: u64, actual: u64 },
    DuplicateShare,
    MalformedShare,
    UnauthorizedWallet,
}

#[derive(Debug, Default)]
pub struct FakePoolHarness {
    next_session_id: u64,
    next_job_id: u64,
    sessions: HashMap<SessionId, MinerSession>,
    jobs: HashMap<JobId, MiningJob>,
    submitted_shares: HashSet<ShareKey>,
}

impl FakePoolHarness {
    pub fn new() -> Self {
        Self {
            next_session_id: 1,
            next_job_id: 1,
            sessions: HashMap::new(),
            jobs: HashMap::new(),
            submitted_shares: HashSet::new(),
        }
    }

    pub fn register_session(
        &mut self,
        wallet: impl Into<String>,
        worker: impl Into<String>,
        difficulty: u64,
    ) -> Result<SessionId, RejectReason> {
        let wallet = Wallet::parse(wallet)?;
        let worker = WorkerName::new(worker);
        let session_id = SessionId(self.next_session_id);
        self.next_session_id += 1;
        let session = MinerSession::new(session_id, wallet, worker, difficulty);
        self.sessions.insert(session_id, session);
        Ok(session_id)
    }

    pub fn create_job(
        &mut self,
        height: u64,
        required_difficulty: u64,
        seed_hash: Hash32,
    ) -> JobId {
        let job_id = JobId(self.next_job_id);
        self.next_job_id += 1;
        let job = MiningJob {
            id: job_id,
            height,
            required_difficulty: required_difficulty.max(1),
            seed_hash,
        };
        self.jobs.insert(job_id, job);
        job_id
    }

    pub fn assign_job(&mut self, session_id: SessionId, job_id: JobId) -> Result<(), RejectReason> {
        if !self.jobs.contains_key(&job_id) {
            return Err(RejectReason::StaleJob);
        }
        let session = self
            .sessions
            .get_mut(&session_id)
            .ok_or(RejectReason::UnknownSession)?;
        session.active_job = Some(job_id);
        Ok(())
    }

    pub fn submit_share(&mut self, submit: ShareSubmit) -> ShareResult {
        if submit.share_difficulty == 0 {
            return self.reject(
                Some(submit.session_id),
                Some(submit.job_id),
                RejectReason::MalformedShare,
            );
        }

        let Some(session) = self.sessions.get(&submit.session_id) else {
            return self.reject(
                Some(submit.session_id),
                Some(submit.job_id),
                RejectReason::UnknownSession,
            );
        };

        if session.active_job != Some(submit.job_id) || !self.jobs.contains_key(&submit.job_id) {
            return self.reject(
                Some(submit.session_id),
                Some(submit.job_id),
                RejectReason::StaleJob,
            );
        }

        let required = session.difficulty.max(
            self.jobs
                .get(&submit.job_id)
                .map(|job| job.required_difficulty)
                .unwrap_or(1),
        );
        if submit.share_difficulty < required {
            return self.reject(
                Some(submit.session_id),
                Some(submit.job_id),
                RejectReason::LowDifficulty {
                    required,
                    actual: submit.share_difficulty,
                },
            );
        }

        let key = submit.key();
        if !self.submitted_shares.insert(key) {
            return self.reject(
                Some(submit.session_id),
                Some(submit.job_id),
                RejectReason::DuplicateShare,
            );
        }

        let session = self
            .sessions
            .get_mut(&submit.session_id)
            .expect("session was checked before accepting share");
        session.accepted_shares += 1;

        ShareResult::Accepted(AcceptedShare {
            session_id: submit.session_id,
            job_id: submit.job_id,
            credited_difficulty: submit.share_difficulty,
        })
    }

    pub fn session(&self, session_id: SessionId) -> Option<&MinerSession> {
        self.sessions.get(&session_id)
    }

    fn reject(
        &mut self,
        session_id: Option<SessionId>,
        job_id: Option<JobId>,
        reason: RejectReason,
    ) -> ShareResult {
        if let Some(session_id) = session_id {
            if let Some(session) = self.sessions.get_mut(&session_id) {
                session.rejected_shares += 1;
            }
        }

        ShareResult::Rejected(RejectedShare {
            session_id,
            job_id,
            reason,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn submit(session_id: SessionId, job_id: JobId, nonce: u64, difficulty: u64) -> ShareSubmit {
        ShareSubmit {
            session_id,
            job_id,
            nonce,
            share_difficulty: difficulty,
            result_hash: Hash32::zero(),
        }
    }

    #[test]
    fn accepts_share_that_meets_session_and_job_difficulty() {
        let mut pool = FakePoolHarness::new();
        let session_id = pool
            .register_session("wallet-one", "worker-a", 100)
            .expect("valid session");
        let job_id = pool.create_job(1_000, 64, Hash32::zero());
        pool.assign_job(session_id, job_id).expect("valid job");

        let result = pool.submit_share(submit(session_id, job_id, 42, 100));

        assert_eq!(
            result,
            ShareResult::Accepted(AcceptedShare {
                session_id,
                job_id,
                credited_difficulty: 100,
            })
        );
        let session = pool.session(session_id).expect("session should exist");
        assert_eq!(session.accepted_shares, 1);
        assert_eq!(session.rejected_shares, 0);
    }

    #[test]
    fn rejects_low_difficulty_share_with_visible_reason() {
        let mut pool = FakePoolHarness::new();
        let session_id = pool
            .register_session("wallet-one", "worker-a", 200)
            .expect("valid session");
        let job_id = pool.create_job(1_000, 64, Hash32::zero());
        pool.assign_job(session_id, job_id).expect("valid job");

        let result = pool.submit_share(submit(session_id, job_id, 42, 100));

        assert_eq!(
            result,
            ShareResult::Rejected(RejectedShare {
                session_id: Some(session_id),
                job_id: Some(job_id),
                reason: RejectReason::LowDifficulty {
                    required: 200,
                    actual: 100,
                },
            })
        );
        let session = pool.session(session_id).expect("session should exist");
        assert_eq!(session.accepted_shares, 0);
        assert_eq!(session.rejected_shares, 1);
    }

    #[test]
    fn rejects_duplicate_share() {
        let mut pool = FakePoolHarness::new();
        let session_id = pool
            .register_session("wallet-one", "worker-a", 10)
            .expect("valid session");
        let job_id = pool.create_job(1_000, 10, Hash32::zero());
        pool.assign_job(session_id, job_id).expect("valid job");

        assert!(matches!(
            pool.submit_share(submit(session_id, job_id, 7, 10)),
            ShareResult::Accepted(_)
        ));
        let result = pool.submit_share(submit(session_id, job_id, 7, 10));

        assert_eq!(
            result,
            ShareResult::Rejected(RejectedShare {
                session_id: Some(session_id),
                job_id: Some(job_id),
                reason: RejectReason::DuplicateShare,
            })
        );
        let session = pool.session(session_id).expect("session should exist");
        assert_eq!(session.accepted_shares, 1);
        assert_eq!(session.rejected_shares, 1);
    }

    #[test]
    fn rejects_unknown_session_without_mutating_known_sessions() {
        let mut pool = FakePoolHarness::new();
        let known_session = pool
            .register_session("wallet-one", "worker-a", 10)
            .expect("valid session");
        let job_id = pool.create_job(1_000, 10, Hash32::zero());

        let result = pool.submit_share(submit(SessionId(99), job_id, 7, 10));

        assert_eq!(
            result,
            ShareResult::Rejected(RejectedShare {
                session_id: Some(SessionId(99)),
                job_id: Some(job_id),
                reason: RejectReason::UnknownSession,
            })
        );
        let session = pool.session(known_session).expect("session should exist");
        assert_eq!(session.accepted_shares, 0);
        assert_eq!(session.rejected_shares, 0);
    }

    #[test]
    fn rejects_stale_job() {
        let mut pool = FakePoolHarness::new();
        let session_id = pool
            .register_session("wallet-one", "worker-a", 10)
            .expect("valid session");
        let old_job = pool.create_job(1_000, 10, Hash32::zero());
        let active_job = pool.create_job(1_001, 10, Hash32::zero());
        pool.assign_job(session_id, active_job)
            .expect("valid active job");

        let result = pool.submit_share(submit(session_id, old_job, 7, 10));

        assert_eq!(
            result,
            ShareResult::Rejected(RejectedShare {
                session_id: Some(session_id),
                job_id: Some(old_job),
                reason: RejectReason::StaleJob,
            })
        );
    }

    #[test]
    fn rejects_empty_wallet_at_registration_boundary() {
        let mut pool = FakePoolHarness::new();

        let result = pool.register_session("   ", "worker-a", 10);

        assert_eq!(result, Err(RejectReason::UnauthorizedWallet));
    }
}
