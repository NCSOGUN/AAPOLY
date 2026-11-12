import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bike,
  CarFront,
  FileText,
  Footprints,
  LoaderCircle,
  MapPin,
  Printer,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import logo from "../../../assets/aap-logo-img.png";
import {
  findNearbyReferralFacilities,
  type HospitalFacility,
  type NearbyFacilitiesQuery,
  type NearbyFacility,
} from "@/lib/api";
import type { SecureSessionVault } from "@/lib/sessionStore";
import { printWithClass } from "@/lib/print";

type ReferralDraftData = {
  patientName: string;
  primaryCondition: string;
  reason: string;
  urgencyScore: number;
  referringDoctor: string;
  referringFacility: string;
  targetFacility: NearbyFacility;
};

type SavedDraft = {
  id: string;
  createdAt: string;
  status: string;
  data: ReferralDraftData;
};

type Props = {
  token: string;
  vault: SecureSessionVault;
  doctorName: string;
  facility: HospitalFacility;
  isOffline: boolean;
};

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function isReferralDraftData(value: unknown): value is ReferralDraftData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ReferralDraftData>;
  return (
    typeof data.patientName === "string" &&
    typeof data.primaryCondition === "string" &&
    typeof data.reason === "string" &&
    typeof data.urgencyScore === "number" &&
    typeof data.referringDoctor === "string" &&
    typeof data.referringFacility === "string" &&
    !!data.targetFacility &&
    typeof data.targetFacility.name === "string"
  );
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function facilityLocation(facility: NearbyFacility) {
  return [facility.address, facility.city, facility.state].filter(Boolean).join(", ");
}

function distanceLabel(facility: NearbyFacility) {
  if (typeof facility.distanceKm === "number") return `${facility.distanceKm.toFixed(1)} km`;
  if (typeof facility.distance === "number") return `${facility.distance.toFixed(1)} km`;
  if (typeof facility.distance === "string" && facility.distance.trim()) return facility.distance;
  return "";
}

function getTravelTimes(value: NearbyFacility["travelTimes"]) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }
  return value;
}

function TravelTimes({ value }: { value: NearbyFacility["travelTimes"] }) {
  const times = getTravelTimes(value);
  if (!times) return null;
  const modes = [
    { key: "driving", label: "Driving", Icon: CarFront },
    { key: "walking", label: "Walking", Icon: Footprints },
    { key: "motorcycle", label: "Motorcycle", Icon: Bike },
  ];
  const availableModes = modes.flatMap(({ key, label, Icon }) => {
    const time = times[key];
    if (
      typeof time !== "string" &&
      typeof time !== "number"
    ) return [];
    return [{ key, label, Icon, time: String(time) }];
  });
  if (!availableModes.length) return null;

  return (
    <div className="facility-travel" aria-label="Estimated travel times">
      {availableModes.map(({ key, label, Icon, time }) => (
        <div className={`travel-mode travel-mode-${key}`} key={key}>
          <span className="travel-icon"><Icon size={16} aria-hidden="true" /></span>
          <span className="travel-copy"><span>{label}</span><strong>{time}</strong></span>
          {key === "driving" && <span className="travel-road" aria-hidden="true"><i /></span>}
        </div>
      ))}
    </div>
  );
}

export function ReferralWorkflow({
  token,
  vault,
  doctorName,
  facility,
  isOffline,
}: Props) {
  const [condition, setCondition] = useState("");
  const [specialists, setSpecialists] = useState("ENT");
  const [requiredServices, setRequiredServices] = useState("");
  const [urgency, setUrgency] = useState("6");
  const [latitude, setLatitude] = useState(
    facility.latitude === undefined ? "" : String(facility.latitude),
  );
  const [longitude, setLongitude] = useState(
    facility.longitude === undefined ? "" : String(facility.longitude),
  );
  const [radius, setRadius] = useState("50");
  const [facilities, setFacilities] = useState<NearbyFacility[]>([]);
  const [sortNote, setSortNote] = useState("");
  const [selectedFacility, setSelectedFacility] = useState<NearbyFacility | null>(null);
  const [patientName, setPatientName] = useState("");
  const [reason, setReason] = useState("");
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<SavedDraft | null>(null);
  const [printDraft, setPrintDraft] = useState<SavedDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "success">("info");

  async function loadDrafts() {
    try {
      const saved = await vault.listReferralDrafts();
      const validDrafts: SavedDraft[] = [];
      for (const draft of saved) {
        if (!isReferralDraftData(draft.data)) {
          throw new Error(`Saved referral ${draft.id} has invalid data.`);
        }
        validDrafts.push({ ...draft, data: draft.data });
      }
      setDrafts(validDrafts);
      setSelectedDraft((current) =>
        current ? validDrafts.find((draft) => draft.id === current.id) ?? null : null,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load saved referral drafts.",
      );
    }
  }

  useEffect(() => {
    void loadDrafts();
  }, [vault]);

  useEffect(() => {
    if (!printDraft) return;
    let active = true;
    void printWithClass("print-referral", ".referral-print-sheet").then(() => {
      if (active) setPrintDraft(null);
    }).catch((printError: unknown) => {
      if (active) {
        setError(
          printError instanceof Error ? printError.message : "Could not print the referral letter.",
        );
        setPrintDraft(null);
      }
    });
    return () => {
      active = false;
    };
  }, [printDraft]);

  async function searchFacilities(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setNoticeTone("info");
    setFacilities([]);
    setSelectedFacility(null);

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    const parsedUrgency = Number(urgency);
    const parsedRadius = Number(radius);
    if (!condition.trim()) {
      setError("Enter the primary condition for this referral.");
      return;
    }
    if (
      !Number.isFinite(parsedLatitude) ||
      parsedLatitude < -90 ||
      parsedLatitude > 90 ||
      !Number.isFinite(parsedLongitude) ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      setError("Enter valid facility coordinates before searching.");
      return;
    }
    if (!Number.isInteger(parsedUrgency) || parsedUrgency < 1 || parsedUrgency > 10) {
      setError("Urgency score must be a whole number from 1 to 10.");
      return;
    }
    if (!Number.isFinite(parsedRadius) || parsedRadius < 1 || parsedRadius > 500) {
      setError("Search radius must be between 1 and 500 kilometres.");
      return;
    }
    if (isOffline) {
      setError("Connect to the internet to search for referral facilities.");
      return;
    }

    const query: NearbyFacilitiesQuery = {
      primaryCondition: condition.trim(),
      specialists: splitList(specialists),
      urgencyScore: parsedUrgency,
      requiredServices: splitList(requiredServices),
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      radiusKm: parsedRadius,
      limit: 8,
    };

    setLoading(true);
    try {
      const result = await findNearbyReferralFacilities(token, query);
      setFacilities(result.facilities);
      setSortNote(
        typeof result.query?.sortNote === "string" ? result.query.sortNote : "",
      );
      if (result.facilities.length === 0) {
        setNotice("No matching facilities were found. Try a wider search radius or different services.");
        setNoticeTone("info");
      } else {
        setNotice(`${result.facilities.length} referral ${result.facilities.length === 1 ? "facility" : "facilities"} found.`);
        setNoticeTone("success");
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not search for referral facilities.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFacility) {
      setError("Select a referral facility before creating a draft.");
      return;
    }
    if (!patientName.trim() || !reason.trim()) {
      setError("Enter the patient's name and referral reason.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    setNoticeTone("info");
    const data: ReferralDraftData = {
      patientName: patientName.trim(),
      primaryCondition: condition.trim(),
      reason: reason.trim(),
      urgencyScore: Number(urgency),
      referringDoctor: doctorName,
      referringFacility: facility.name,
      targetFacility: selectedFacility,
    };
    try {
      const saved = await vault.saveReferralDraft(data);
      const draft: SavedDraft = { ...saved, status: "draft", data };
      setDrafts((current) => [draft, ...current]);
      setSelectedDraft(draft);
      setSelectedFacility(null);
      setPatientName("");
      setReason("");
      setNotice("Referral draft saved encrypted on this device. It has not been sent to the receiving facility.");
      setNoticeTone("success");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? `Could not save this referral: ${saveError.message}`
          : "Could not save this referral. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="workspace-panel">
      <div className="panel-title">
        <div>
          <h2>Find a referral facility</h2>
          <p>Search nearby hospitals, select a destination and save a referral draft locally.</p>
        </div>
      </div>

      <Card className="panel-card">
        <form className="referral-search-form" onSubmit={(event) => void searchFacilities(event)}>
          <label className="field full-width">
            <span className="field-label">Primary condition</span>
            <Input className="field-control" value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="e.g. Acute Otitis Media" />
          </label>
          <label className="field">
            <span className="field-label">Specialists</span>
            <Input className="field-control" value={specialists} onChange={(event) => setSpecialists(event.target.value)} placeholder="ENT, Paediatric ENT" />
          </label>
          <label className="field">
            <span className="field-label">Required services</span>
            <Input className="field-control" value={requiredServices} onChange={(event) => setRequiredServices(event.target.value)} placeholder="Audiometry" />
          </label>
          <label className="field">
            <span className="field-label">Urgency score (1–10)</span>
            <Input className="field-control" type="number" min="1" max="10" value={urgency} onChange={(event) => setUrgency(event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Search radius (km)</span>
            <Input className="field-control" type="number" min="1" max="500" value={radius} onChange={(event) => setRadius(event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Facility latitude</span>
            <Input className="field-control" type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="6.849044" />
          </label>
          <label className="field">
            <span className="field-label">Facility longitude</span>
            <Input className="field-control" type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="3.653023" />
          </label>
          <div className="referral-search-action">
            <p>{isOffline ? "Facility search needs an internet connection." : `Searching from ${facility.name}.`}</p>
            <Button type="submit" disabled={loading || isOffline}>
              {loading ? <LoaderCircle size={15} className="spin" /> : <Search size={15} />}
              {loading ? "Searching…" : "Find facilities"}
            </Button>
          </div>
        </form>
      </Card>

      {error && <div className="panel-error" role="alert"><AlertCircle size={16} />{error}</div>}
      {notice && (
        <div className={`panel-notice ${noticeTone}`} role="status">
          <span>{notice}</span>
          {notice.startsWith("Referral draft saved") && selectedDraft && (
            <Button type="button" variant="outline" onClick={() => setPrintDraft(selectedDraft)}>
              <Printer size={14} /> Print referral letter
            </Button>
          )}
        </div>
      )}

      {facilities.length > 0 && (
        <section className="referral-results" aria-label="Referral facilities">
          <div className="referral-results-heading">
            <div>
              <span className="section-kicker">MATCHING FACILITIES</span>
              <h3>{facilities.length} facilities found</h3>
            </div>
            {sortNote && <p>{sortNote}</p>}
          </div>
          <div className="facility-list">
            {facilities.map((item, index) => (
              <Card className="facility-card" key={item.id ?? `${item.name}-${index}`}>
                <div className="case-card-heading">
                  <div>
                    <h3>{item.name}</h3>
                    {facilityLocation(item) && <p className="facility-address"><MapPin size={14} />{facilityLocation(item)}</p>}
                  </div>
                  {distanceLabel(item) && <span className="case-tag">{distanceLabel(item)}</span>}
                </div>
                <div className="facility-meta">
                  {item.specialties?.length ? <span>Specialties: {item.specialties.join(", ")}</span> : null}
                  {typeof item.accredited === "boolean" && <span>{item.accredited ? "Accredited" : "Accreditation not confirmed"}</span>}
                </div>
                <TravelTimes value={item.travelTimes} />
                <div className="case-actions">
                  <Button type="button" variant="outline" onClick={() => { setSelectedFacility(item); setError(""); setNotice(""); }}>
                    <FileText size={15} /> Create referral
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {selectedFacility && (
        <Card className="panel-card referral-draft-form-card">
          <div className="panel-title">
            <div>
              <h2>Referral draft for {selectedFacility.name}</h2>
              <p>This draft is stored encrypted on this device and is not transmitted.</p>
            </div>
          </div>
          <form className="referral-draft-form" onSubmit={(event) => void saveDraft(event)}>
            <label className="field">
              <span className="field-label">Patient name</span>
              <Input className="field-control" value={patientName} onChange={(event) => setPatientName(event.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              <span className="field-label">Primary condition</span>
              <Input className="field-control" value={condition} readOnly />
            </label>
            <label className="field full-width">
              <span className="field-label">Reason for referral</span>
              <Textarea className="field-textarea case-notes" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Summarize why specialist review is requested…" />
            </label>
            <div className="case-actions">
              <Button type="button" variant="outline" onClick={() => setSelectedFacility(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <LoaderCircle size={15} className="spin" /> : <FileText size={15} />}
                {saving ? "Saving…" : "Save local draft"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {drafts.length > 0 && (
        <section className="referral-drafts">
          <div className="referral-results-heading">
            <div>
              <span className="section-kicker">ON THIS DEVICE</span>
              <h3>Saved referral drafts</h3>
            </div>
          </div>
          <div className="referral-draft-list">
            {drafts.map((draft) => (
              <button
                type="button"
                className={`referral-draft-item${selectedDraft?.id === draft.id ? " selected" : ""}`}
                key={draft.id}
                onClick={() => setSelectedDraft(draft)}
              >
                <strong>{draft.data.patientName}</strong>
                <span>{draft.data.targetFacility.name}</span>
                <small>{dateLabel(draft.createdAt)} · {draft.status}</small>
              </button>
            ))}
          </div>
          {selectedDraft && (
            <Card className="report-card">
              <div className="report-card-heading">
                <div>
                  <span className="section-kicker">LOCAL REFERRAL DRAFT</span>
                  <h3>{selectedDraft.data.patientName}</h3>
                </div>
                <span className="report-source">{dateLabel(selectedDraft.createdAt)}</span>
              </div>
              <dl className="report-fields">
                <div className="report-field"><dt>Condition</dt><dd>{selectedDraft.data.primaryCondition}</dd></div>
                <div className="report-field"><dt>Urgency score</dt><dd>{selectedDraft.data.urgencyScore}</dd></div>
                <div className="report-field"><dt>Referring clinician</dt><dd>{selectedDraft.data.referringDoctor}</dd></div>
                <div className="report-field"><dt>Referring facility</dt><dd>{selectedDraft.data.referringFacility}</dd></div>
                <div className="report-field"><dt>Receiving facility</dt><dd>{selectedDraft.data.targetFacility.name}{facilityLocation(selectedDraft.data.targetFacility) ? `, ${facilityLocation(selectedDraft.data.targetFacility)}` : ""}</dd></div>
                <div className="report-field"><dt>Reason for referral</dt><dd>{selectedDraft.data.reason}</dd></div>
              </dl>
              <div className="case-actions">
                <Button type="button" variant="outline" onClick={() => setPrintDraft(selectedDraft)}>
                  <Printer size={15} /> Print referral letter
                </Button>
              </div>
            </Card>
          )}
        </section>
      )}

      {printDraft && (
        <article className="referral-print-sheet">
          <img className="print-watermark report-print-watermark" src={logo} alt="" aria-hidden="true" />
          <header className="referral-print-header">
            <img src={logo} alt="" />
            <div><h1>Patient referral letter</h1><p>Referring hospital: <strong>{printDraft.data.referringFacility}</strong></p></div>
          </header>
          <div className="referral-letter-meta"><span><strong>Referral ID:</strong> {printDraft.id}</span><span><strong>Date:</strong> {dateLabel(printDraft.createdAt)}</span></div>
          <p className="referral-print-status">Please assess and provide appropriate specialist care for the patient named below.</p>
          <section><h2>To</h2><p><strong>{printDraft.data.targetFacility.name}</strong></p><p>{facilityLocation(printDraft.data.targetFacility)}</p></section>
          <section><h2>Patient details</h2><p><strong>Patient name:</strong> {printDraft.data.patientName}</p></section>
          <section><h2>Clinical referral</h2><p><strong>Primary condition:</strong> {printDraft.data.primaryCondition}</p><p><strong>Urgency:</strong> {printDraft.data.urgencyScore}/10</p><p><strong>Reason for referral:</strong></p><p className="referral-letter-reason">{printDraft.data.reason}</p></section>
          <section><h2>Referring clinician</h2><p><strong>Clinician:</strong> {printDraft.data.referringDoctor}</p><p><strong>Hospital / medical centre:</strong> {printDraft.data.referringFacility}</p></section>
          <p className="referral-letter-closing">Thank you for reviewing this patient. Please contact the referring hospital if further information is required.</p>
          <div className="referral-letter-signature"><span>Referring clinician signature</span><i /><span>Date</span><i /></div>
          <footer>This referral letter was generated locally for the patient to present to the receiving facility. It has not been transmitted electronically. Keep patient information confidential.</footer>
        </article>
      )}
    </div>
  );
}
