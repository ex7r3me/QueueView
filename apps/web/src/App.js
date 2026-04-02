import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
const REFRESH_INTERVAL_MS = 5000;
async function apiRequest(path, init) {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
    const response = await fetch(`${apiBaseUrl}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {})
        }
    });
    if (!response.ok) {
        let message = `Request failed (${response.status})`;
        try {
            const payload = (await response.json());
            if (payload.error) {
                message = payload.error;
            }
        }
        catch {
            // no-op: keep fallback message
        }
        throw new Error(message);
    }
    return (await response.json());
}
function formatTimestamp(iso) {
    return new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}
export function App() {
    const [mode, setMode] = useState("host");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [hostName, setHostName] = useState("");
    const [sessions, setSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState("");
    const [hostSession, setHostSession] = useState(null);
    const [participantSessionId, setParticipantSessionId] = useState("");
    const [participantName, setParticipantName] = useState("");
    const [participantEntryId, setParticipantEntryId] = useState("");
    const [participantSession, setParticipantSession] = useState(null);
    const reportError = useCallback((value) => {
        const nextError = value instanceof Error ? value.message : "Something went wrong";
        setError(nextError);
        setMessage("");
    }, []);
    const reportSuccess = useCallback((value) => {
        setMessage(value);
        setError("");
    }, []);
    const loadSessions = useCallback(async () => {
        try {
            const payload = await apiRequest("/sessions");
            setSessions(payload.sessions);
        }
        catch (loadError) {
            reportError(loadError);
        }
    }, [reportError]);
    const loadHostSession = useCallback(async (sessionId) => {
        if (!sessionId) {
            setHostSession(null);
            return;
        }
        try {
            const payload = await apiRequest(`/sessions/${sessionId}`);
            setHostSession(payload.session);
        }
        catch (loadError) {
            reportError(loadError);
        }
    }, [reportError]);
    const loadParticipantSession = useCallback(async (sessionId) => {
        if (!sessionId) {
            setParticipantSession(null);
            return;
        }
        try {
            const payload = await apiRequest(`/sessions/${sessionId}`);
            setParticipantSession(payload.session);
        }
        catch (loadError) {
            reportError(loadError);
        }
    }, [reportError]);
    useEffect(() => {
        void loadSessions();
    }, [loadSessions]);
    useEffect(() => {
        if (!selectedSessionId && !participantSessionId) {
            return;
        }
        const interval = window.setInterval(() => {
            if (selectedSessionId) {
                void loadHostSession(selectedSessionId);
            }
            if (participantSessionId) {
                void loadParticipantSession(participantSessionId);
            }
        }, REFRESH_INTERVAL_MS);
        return () => {
            window.clearInterval(interval);
        };
    }, [loadHostSession, loadParticipantSession, participantSessionId, selectedSessionId]);
    const waitingCount = useMemo(() => hostSession?.queue.filter((entry) => entry.state === "waiting").length ?? 0, [hostSession]);
    const calledCount = useMemo(() => hostSession?.queue.filter((entry) => entry.state === "called").length ?? 0, [hostSession]);
    const participantEntry = useMemo(() => participantSession?.queue.find((entry) => entry.id === participantEntryId) ?? null, [participantEntryId, participantSession]);
    async function createSession(event) {
        event.preventDefault();
        try {
            const payload = await apiRequest("/sessions", {
                method: "POST",
                body: JSON.stringify({ hostName })
            });
            setHostName("");
            setSelectedSessionId(payload.session.id);
            setHostSession(payload.session);
            await loadSessions();
            reportSuccess(`Session ${payload.session.id} created`);
        }
        catch (createError) {
            reportError(createError);
        }
    }
    async function selectSession(sessionId) {
        setSelectedSessionId(sessionId);
        await loadHostSession(sessionId);
    }
    async function updateSessionState(nextState) {
        if (!hostSession) {
            return;
        }
        try {
            const payload = await apiRequest(`/sessions/${hostSession.id}`, {
                method: "PATCH",
                body: JSON.stringify({ state: nextState })
            });
            setHostSession(payload.session);
            await loadSessions();
            reportSuccess(`Session moved to ${nextState}`);
        }
        catch (updateError) {
            reportError(updateError);
        }
    }
    async function updateQueueEntryState(queueEntryId, state) {
        if (!hostSession) {
            return;
        }
        try {
            await apiRequest(`/sessions/${hostSession.id}/queue/${queueEntryId}`, {
                method: "PATCH",
                body: JSON.stringify({ state })
            });
            await loadHostSession(hostSession.id);
            reportSuccess(`Queue entry moved to ${state}`);
        }
        catch (updateError) {
            reportError(updateError);
        }
    }
    async function callNextParticipant() {
        const nextWaiting = hostSession?.queue.find((entry) => entry.state === "waiting");
        if (!nextWaiting) {
            reportError(new Error("No waiting participants"));
            return;
        }
        await updateQueueEntryState(nextWaiting.id, "called");
    }
    async function joinQueue(event) {
        event.preventDefault();
        try {
            const payload = await apiRequest(`/sessions/${participantSessionId}/queue`, {
                method: "POST",
                body: JSON.stringify({ displayName: participantName })
            });
            setParticipantEntryId(payload.queueEntry.id);
            setParticipantName("");
            await loadParticipantSession(participantSessionId);
            reportSuccess("Joined queue successfully");
        }
        catch (joinError) {
            reportError(joinError);
        }
    }
    async function refreshParticipantView() {
        await loadParticipantSession(participantSessionId);
    }
    return (_jsxs("main", { className: "app-shell", children: [_jsxs("header", { className: "hero", children: [_jsx("p", { className: "eyebrow", children: "Queuview MVP" }), _jsx("h1", { children: "Live Queue Control" }), _jsx("p", { className: "subtitle", children: "Hosts manage flow. Participants track their position in real time." })] }), _jsxs("section", { className: "mode-switch", "aria-label": "View mode", children: [_jsx("button", { type: "button", className: mode === "host" ? "mode-pill active" : "mode-pill", onClick: () => setMode("host"), children: "Host Console" }), _jsx("button", { type: "button", className: mode === "participant" ? "mode-pill active" : "mode-pill", onClick: () => setMode("participant"), children: "Participant View" })] }), error ? (_jsx("p", { role: "alert", className: "banner error", children: error })) : null, message ? _jsx("p", { className: "banner success", children: message }) : null, mode === "host" ? (_jsxs("section", { className: "panel-grid", children: [_jsxs("article", { className: "panel", children: [_jsx("h2", { children: "Create session" }), _jsxs("form", { className: "stack", onSubmit: createSession, children: [_jsx("label", { htmlFor: "host-name", children: "Host display name" }), _jsx("input", { id: "host-name", value: hostName, onChange: (event) => setHostName(event.target.value), placeholder: "Alex from support" }), _jsx("button", { type: "submit", children: "Create queue" })] })] }), _jsxs("article", { className: "panel", children: [_jsxs("div", { className: "panel-header", children: [_jsx("h2", { children: "Sessions" }), _jsx("button", { type: "button", className: "ghost", onClick: () => void loadSessions(), children: "Refresh" })] }), sessions.length === 0 ? _jsx("p", { children: "No sessions yet." }) : null, _jsx("ul", { className: "session-list", children: sessions.map((session) => (_jsx("li", { children: _jsxs("button", { type: "button", className: selectedSessionId === session.id ? "session-item selected" : "session-item", onClick: () => void selectSession(session.id), children: [_jsx("span", { children: session.hostName }), _jsx("span", { children: session.state }), _jsxs("span", { children: [session.queueSize, " in queue"] })] }) }, session.id))) })] }), _jsxs("article", { className: "panel wide", children: [_jsx("h2", { children: "Live queue controls" }), !hostSession ? _jsx("p", { children: "Select a session to manage it." }) : null, hostSession ? (_jsxs(_Fragment, { children: [_jsxs("p", { children: ["Session ", _jsx("strong", { children: hostSession.id }), " | state: ", _jsx("strong", { children: hostSession.state })] }), _jsxs("div", { className: "inline-actions", children: [_jsx("button", { type: "button", onClick: () => void updateSessionState("open"), children: "Open" }), _jsx("button", { type: "button", onClick: () => void updateSessionState("paused"), children: "Pause" }), _jsx("button", { type: "button", onClick: () => void updateSessionState("closed"), children: "Close" }), _jsx("button", { type: "button", className: "accent", onClick: () => void callNextParticipant(), children: "Call next waiting" })] }), _jsxs("p", { children: ["Waiting: ", _jsx("strong", { children: waitingCount }), " | Called: ", _jsx("strong", { children: calledCount }), " | Total:", " ", _jsx("strong", { children: hostSession.queue.length })] }), _jsx("ul", { className: "queue-list", children: hostSession.queue.map((entry) => (_jsxs("li", { className: "queue-item", children: [_jsxs("div", { children: [_jsx("p", { className: "queue-name", children: entry.displayName }), _jsxs("p", { className: "queue-meta", children: [entry.state, " | joined ", formatTimestamp(entry.joinedAt)] })] }), _jsxs("div", { className: "mini-actions", children: [_jsx("button", { type: "button", onClick: () => void updateQueueEntryState(entry.id, "called"), children: "Call" }), _jsx("button", { type: "button", onClick: () => void updateQueueEntryState(entry.id, "completed"), children: "Complete" }), _jsx("button", { type: "button", onClick: () => void updateQueueEntryState(entry.id, "cancelled"), children: "Cancel" })] })] }, entry.id))) })] })) : null] })] })) : (_jsxs("section", { className: "panel-grid", children: [_jsxs("article", { className: "panel", children: [_jsx("h2", { children: "Join a queue" }), _jsxs("form", { className: "stack", onSubmit: joinQueue, children: [_jsx("label", { htmlFor: "session-id", children: "Session ID" }), _jsx("input", { id: "session-id", value: participantSessionId, onChange: (event) => setParticipantSessionId(event.target.value), placeholder: "Paste session id" }), _jsx("label", { htmlFor: "participant-name", children: "Display name" }), _jsx("input", { id: "participant-name", value: participantName, onChange: (event) => setParticipantName(event.target.value), placeholder: "Taylor" }), _jsx("button", { type: "submit", children: "Join queue" })] })] }), _jsxs("article", { className: "panel wide", children: [_jsxs("div", { className: "panel-header", children: [_jsx("h2", { children: "Live status" }), _jsx("button", { type: "button", className: "ghost", onClick: () => void refreshParticipantView(), children: "Refresh now" })] }), !participantSession ? _jsx("p", { children: "Join or refresh a session to view your status." }) : null, participantSession ? (_jsxs(_Fragment, { children: [_jsxs("p", { children: ["Session ", participantSession.id, " is ", _jsx("strong", { children: participantSession.state })] }), _jsxs("p", { children: ["Queue length: ", _jsx("strong", { children: participantSession.queue.length })] }), participantEntry ? (_jsxs("p", { children: ["Your status: ", _jsx("strong", { children: participantEntry.state })] })) : (_jsx("p", { children: "Your queue entry is not visible yet. It may have been removed." }))] })) : null] })] }))] }));
}
