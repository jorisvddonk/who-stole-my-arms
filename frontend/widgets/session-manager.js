export class SessionManager {
  constructor() {
    if (SessionManager.instance) {
      return SessionManager.instance;
    }
    SessionManager.instance = this;

    this.currentSession = sessionStorage.getItem('currentSession') || 'default';
    this.sessions = [];
    this.listeners = new Set();
  }

  // Get singleton instance
  static getInstance() {
    if (!SessionManager.instance) {
      new SessionManager();
    }
    return SessionManager.instance;
  }

  // Get current session
  getCurrentSession() {
    return this.currentSession;
  }

  // Get all available sessions
  getSessions() {
    return [...this.sessions];
  }

  // Load sessions from server
  async loadSessions() {
    try {
      const res = await fetch('/sessions');
      if (res.ok) {
        const data = await res.json();
        this.sessions = data.sessions || [];
        // Ensure current session exists in the list
        if (!this.sessions.includes(this.currentSession)) {
          this.sessions.unshift(this.currentSession);
        }
        return this.sessions;
      }
    } catch (error) {
      console.warn('Failed to load sessions:', error);
      this.sessions = [this.currentSession];
      return this.sessions;
    }
  }

  // Switch to a different session
  async switchSession(sessionId) {
    this.currentSession = sessionId;
    sessionStorage.setItem('currentSession', sessionId);

    // Ensure session is in the list
    if (!this.sessions.includes(sessionId)) {
      this.sessions.push(sessionId);
    }

    // Dispatch event
    this.dispatchSessionChanged(sessionId);
  }

  // Create a new session
  async createNewSession() {
    try {
      const res = await fetch('/sessions', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        await this.switchSession(data.sessionId);
        return data.sessionId;
      }
    } catch (error) {
      console.error('Failed to create new session:', error);
      throw error;
    }
  }

  // Add event listener for session changes
  addSessionChangeListener(callback) {
    this.listeners.add(callback);
  }

  // Remove event listener
  removeSessionChangeListener(callback) {
    this.listeners.delete(callback);
  }

  // Dispatch session changed event
  dispatchSessionChanged(sessionId) {
    const event = new CustomEvent('session-changed', { detail: { sessionId } });
    window.dispatchEvent(event);

    // Also call direct listeners
    this.listeners.forEach(callback => {
      try {
        callback(sessionId);
      } catch (error) {
        console.error('Error in session change listener:', error);
      }
    });
  }

  // Initialize (load sessions)
  async initialize() {
    await this.loadSessions();
    return this.currentSession;
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();