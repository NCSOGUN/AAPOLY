import { useEffect, useState } from "react";
import { AlertCircle, LoaderCircle, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getEscalatedCases, updateEscalatedCase } from "@/lib/api";

type EscalatedCase = Record<string, unknown> & { id?: string };

function recordText(record: EscalatedCase, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return "";
}

export function EscalatedCases({ token }: { token: string }) {
  const [cases, setCases] = useState<EscalatedCase[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyCaseId, setBusyCaseId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const results = await getEscalatedCases(token);
      setCases(results.filter((item): item is EscalatedCase => typeof item === "object"));
    } catch (requestError) {
      setCases([]);
      setError(requestError instanceof Error ? requestError.message : "Could not load escalated cases.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [token]);

  async function respond(caseItem: EscalatedCase) {
    const id = recordText(caseItem, "id", "caseId");
    const specialistNotes = notes[id]?.trim();
    if (!id || !specialistNotes) {
      setError("Enter specialist notes before responding.");
      return;
    }
    setBusyCaseId(id);
    setError("");
    setNotice("");
    try {
      await updateEscalatedCase(token, id, specialistNotes);
      setNotice("Specialist response submitted.");
      setNotes((current) => ({ ...current, [id]: "" }));
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not submit the response.");
    } finally {
      setBusyCaseId("");
    }
  }

  return (
    <div className="workspace-panel">
      <div className="panel-title">
        <div>
          <h2>Escalated cases</h2>
          <p>Review cases flagged for specialist attention and send a clinical response.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </Button>
      </div>
      {error && <div className="panel-error" role="alert"><AlertCircle size={16} />{error}</div>}
      {notice && <div className="panel-notice success" role="status">{notice}</div>}
      {loading ? (
        <div className="panel-loading"><LoaderCircle size={18} className="spin" /> Loading escalated cases…</div>
      ) : cases.length === 0 && !error ? (
        <Card className="empty-panel">
          <h3>No pending escalated cases</h3>
          <p>There are no pending cases to review right now.</p>
        </Card>
      ) : cases.length > 0 ? (
        <div className="case-list">
          {cases.map((caseItem, index) => {
            const id = recordText(caseItem, "id", "caseId") || `case-${index}`;
            const patient = recordText(caseItem, "patientName", "name") || "Patient";
            const condition = recordText(caseItem, "primaryCondition", "condition", "diagnosis");
            const urgency = recordText(caseItem, "urgencyLevel", "urgency", "priority");
            return (
              <Card className="case-card" key={id}>
                <div className="case-card-heading">
                  <div>
                    <span className="section-kicker">{id}</span>
                    <h3>{patient}</h3>
                  </div>
                  {urgency && <span className="case-tag">{urgency}</span>}
                </div>
                {condition && <p className="case-condition">{condition}</p>}
                <label className="field">
                  <span className="field-label">Specialist notes</span>
                  <Textarea
                    className="field-textarea case-notes"
                    value={notes[id] ?? ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [id]: event.target.value }))}
                    placeholder="Add findings and recommended next steps…"
                  />
                </label>
                <div className="case-actions">
                  <Button type="button" onClick={() => void respond(caseItem)} disabled={busyCaseId === id}>
                    {busyCaseId === id ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}
                    {busyCaseId === id ? "Sending…" : "Send response"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
