import React, { useState } from 'react';
import { Upload, AlertTriangle, CheckCircle, Check, X, ShieldAlert, Sparkles, FileText, ArrowRight, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function CSVImportWizard({ groupId, token, onImportSuccess, onCancel }) {
  const [step, setStep] = useState(1); // 1: Upload, 2: Resolve Anomalies, 3: Success Report
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importReport, setImportReport] = useState(null);

  // Handle Drag & Drop / File selection
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
      setError(null);
    } else {
      setError("Please select a valid CSV file");
    }
  };

  // Upload file and parse it
  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/groups/${groupId}/import/parse/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error("Failed to parse the CSV file on backend");
      }

      const data = await response.json();
      setParsedRows(data.rows.map(r => ({
        ...r,
        // Ensure editable fields are bound
        date: r.date,
        description: r.description,
        paid_by: r.paid_by,
        amount: r.amount,
        currency: r.currency,
        exchange_rate: r.exchange_rate,
        split_type: r.split_type,
        split_with: r.split_with,
        split_details: r.split_details,
        exclude: r.anomalies.some(a => a.type === 'zero_amount') // Auto-exclude 0 amount entries
      })));
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Modify row data locally in Wizard
  const updateRowField = (idx, field, value) => {
    setParsedRows(prev => prev.map((row, rIdx) => {
      if (rIdx !== idx) return row;
      
      const updatedRow = { ...row, [field]: value };
      
      // Update computed amounts
      if (field === 'amount' || field === 'exchange_rate') {
        const amt = parseFloat(updatedRow.amount) || 0;
        const rate = parseFloat(updatedRow.exchange_rate) || 1;
        updatedRow.amount_in_inr = amt * rate;
      }
      
      // Clear resolved anomalies related to this field
      updatedRow.anomalies = updatedRow.anomalies.filter(a => {
        if (field === 'paid_by' && a.type === 'missing_payer') return false;
        if (field === 'split_type' && a.type === 'missing_split_type') return false;
        return true;
      });

      return updatedRow;
    }));
  };

  // Toggle exclusion of row
  const toggleExclude = (idx) => {
    setParsedRows(prev => prev.map((row, rIdx) => {
      if (rIdx === idx) {
        return { ...row, exclude: !row.exclude };
      }
      return row;
    }));
  };

  // Auto-resolve anomaly helpers
  const applyAutoResolve = (idx, anomalyType) => {
    setParsedRows(prev => prev.map((row, rIdx) => {
      if (rIdx !== idx) return row;
      
      let updated = { ...row };
      
      if (anomalyType === 'percentage_split_sum_error') {
        // Find percentage anomaly
        const anomaly = row.anomalies.find(a => a.type === 'percentage_split_sum_error');
        if (anomaly) {
          updated.split_details = anomaly.resolved_val;
          // Clear percentage anomaly
          updated.anomalies = updated.anomalies.filter(a => a.type !== 'percentage_split_sum_error');
        }
      }
      
      if (anomalyType === 'split_type_mismatch') {
        // Clear split details since split_type is equal
        updated.split_details = '';
        updated.anomalies = updated.anomalies.filter(a => a.type !== 'split_type_mismatch');
      }

      if (anomalyType === 'inactive_member_in_split') {
        const anomaly = row.anomalies.find(a => a.type === 'inactive_member_in_split');
        if (anomaly) {
          updated.split_with = anomaly.resolved_val;
          updated.anomalies = updated.anomalies.filter(a => a.type !== 'inactive_member_in_split');
        }
      }

      return updated;
    }));
  };

  // Commit finalized import rows to database
  const handleConfirmImport = async () => {
    setLoading(true);
    setError(null);

    // Filter out rows that are duplicates and are to be deleted
    // Or let Django API parse and commit whatever is sent in the array
    try {
      const response = await fetch(`${API_BASE_URL}/api/groups/${groupId}/import/confirm/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rows: parsedRows })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to confirm import");
      }

      const data = await response.json();
      setImportReport(data);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render Step 1: File Upload Screen
  const renderUploadStep = () => (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '700px', margin: '0 auto' }}>
      <div>
        <h2 style={{ justifyContent: 'center' }}><Upload className="icon" /> Import Expenses Export CSV</h2>
        <p style={{ textAlign: 'center' }}>Ingest your spreadsheet export. The wizard will scan, detect, and let you resolve all 19+ anomalies interactively before writing to the database.</p>
      </div>

      <div 
        className="dropzone" 
        onClick={() => document.getElementById('csv-file-input').click()}
        style={{ padding: '60px 40px' }}
      >
        <input 
          id="csv-file-input" 
          type="file" 
          accept=".csv" 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
        />
        <Upload size={48} style={{ color: 'var(--accent)' }} />
        <div>
          <h3 style={{ marginBottom: '8px' }}>{file ? file.name : "Drag & Drop your CSV file here"}</h3>
          <p style={{ fontSize: '0.85rem' }}>{file ? `Size: ${Math.round(file.size / 1024)} KB` : "or click to browse from files"}</p>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: '8px', color: 'var(--danger)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'left', alignItems: 'center' }}>
          <ShieldAlert size={20} />
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button 
          className="btn btn-primary" 
          disabled={!file || loading} 
          onClick={handleUpload}
        >
          {loading ? "Parsing File..." : "Parse & Scan CSV"} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );

  // Render Step 2: Resolve Anomalies Grid View
  const renderResolveStep = () => {
    const totalAnomalies = parsedRows.reduce((acc, row) => acc + (row.exclude ? 0 : row.anomalies.length), 0);
    const criticalIssues = parsedRows.filter(r => !r.exclude && r.anomalies.some(a => a.type === 'missing_payer')).length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', margin: 0 }}><Sparkles style={{ color: 'var(--warning)' }} /> Anomaly Audit Console</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>Scan results: Identified <strong>{totalAnomalies}</strong> warnings/discrepancies. {criticalIssues > 0 && <span style={{ color: 'var(--danger)' }}>Requires fixing {criticalIssues} missing payer(s).</span>}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}><RefreshCw size={16} /> Re-upload</button>
            <button 
              className="btn btn-primary" 
              disabled={loading || criticalIssues > 0} 
              onClick={handleConfirmImport}
            >
              {loading ? "Saving to database..." : "Commit Resolved Data"} <Check size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="glass-panel" style={{ color: 'var(--danger)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '16px', display: 'flex', gap: '10px' }}>
            <ShieldAlert size={20} />
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {parsedRows.map((row, idx) => {
            const hasAnomalies = row.anomalies.length > 0;
            return (
              <div 
                key={idx} 
                className={`anomaly-row ${hasAnomalies && !row.exclude ? 'has-issues' : ''} ${row.exclude ? 'excluded' : ''}`}
                style={{
                  background: row.exclude ? 'rgba(255, 255, 255, 0.02)' : 
                              hasAnomalies ? 'rgba(245, 158, 11, 0.03)' : 'rgba(16, 185, 129, 0.02)',
                  borderColor: row.exclude ? 'var(--panel-border)' :
                               hasAnomalies ? 'var(--warning-border)' : 'var(--success-border)'
                }}
              >
                <div className="anomaly-row-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>CSV ROW {row.csv_row_number}</span>
                    <strong style={{ fontSize: '1.05rem', color: '#fff' }}>{row.description}</strong>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      ₹{parseFloat(row.amount_in_inr).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                      {row.currency !== 'INR' && ` (${row.amount} ${row.currency})`}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="anomaly-badges">
                      {row.anomalies.map((anom, aIdx) => (
                        <span 
                          key={aIdx} 
                          className={`badge ${
                            anom.type === 'missing_payer' ? 'badge-danger' : 
                            anom.type === 'duplicate_entry' ? 'badge-danger' :
                            'badge-warning'
                          }`}
                        >
                          <AlertTriangle size={10} /> {anom.type.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {!hasAnomalies && !row.exclude && (
                        <span className="badge badge-success"><Check size={10} /> Valid Row</span>
                      )}
                    </div>
                    
                    <button 
                      className={`btn ${row.exclude ? 'btn-secondary' : 'btn-danger'}`}
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      onClick={() => toggleExclude(idx)}
                    >
                      {row.exclude ? "Include" : "Exclude"}
                    </button>
                  </div>
                </div>

                {/* Display warnings detail log */}
                {hasAnomalies && !row.exclude && (
                  <div style={{ padding: '8px 12px', background: 'rgba(0, 0, 0, 0.15)', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {row.anomalies.map((anom, aIdx) => (
                      <div key={aIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--warning)' }}>
                        <span>⚠️ {anom.description} (Raw: <code>{anom.raw_val}</code>)</span>
                        {['percentage_split_sum_error', 'split_type_mismatch', 'inactive_member_in_split'].includes(anom.type) && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--success)', borderColor: 'var(--success-border)' }}
                            onClick={() => applyAutoResolve(idx, anom.type)}
                          >
                            Apply Fix: {anom.resolved_val}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline Editing Fields */}
                {!row.exclude && (
                  <div className="anomaly-form">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Date</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        value={row.date} 
                        onChange={(e) => updateRowField(idx, 'date', e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Payer</label>
                      <select 
                        className="form-control" 
                        value={row.paid_by} 
                        onChange={(e) => updateRowField(idx, 'paid_by', e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                      >
                        <option value="">-- Select --</option>
                        <option value="Aisha">Aisha</option>
                        <option value="Rohan">Rohan</option>
                        <option value="Priya">Priya</option>
                        <option value="Meera">Meera</option>
                        <option value="Sam">Sam</option>
                        <option value="Dev">Dev</option>
                        <option value="Kabir">Kabir (Guest)</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Amount ({row.currency})</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={row.amount} 
                        onChange={(e) => updateRowField(idx, 'amount', e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                      />
                    </div>
                    {row.currency !== 'INR' && (
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Ex. Rate (to INR)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="form-control" 
                          value={row.exchange_rate} 
                          onChange={(e) => updateRowField(idx, 'exchange_rate', e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                        />
                      </div>
                    )}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Split Type</label>
                      <select 
                        className="form-control" 
                        value={row.split_type} 
                        onChange={(e) => updateRowField(idx, 'split_type', e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                      >
                        <option value="equal">Equal</option>
                        <option value="share">Share</option>
                        <option value="percentage">Percentage</option>
                        <option value="unequal">Unequal</option>
                        <option value="settlement">Settlement (Transfer)</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Split With (Semicolon separated)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={row.split_with} 
                        onChange={(e) => updateRowField(idx, 'split_with', e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                      />
                    </div>
                    {(row.split_type !== 'equal' && row.split_type !== 'settlement') && (
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Split Details</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          value={row.split_details} 
                          onChange={(e) => updateRowField(idx, 'split_details', e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                          placeholder="e.g. Aisha 2; Rohan 1"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Step 3: Success Import Report
  const renderSuccessStep = () => {
    const { summary, report } = importReport;
    return (
      <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <CheckCircle size={56} style={{ color: 'var(--success)' }} />
          <div>
            <h1 style={{ fontSize: '2rem', margin: 0 }}>Import Completed!</h1>
            <p>Your spreadsheet has been parsed, resolved, and successfully ingested.</p>
          </div>
        </div>

        {/* Ingestion counts widget */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center' }}>
          <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--panel-border)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Expenses Imported</span>
            <strong style={{ fontSize: '2rem', color: 'var(--success)' }}>{summary.expenses_count}</strong>
          </div>
          <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--panel-border)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Settlements Logged</span>
            <strong style={{ fontSize: '2rem', color: 'var(--accent)' }}>{summary.settlements_count}</strong>
          </div>
          <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--panel-border)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Total Ingested Items</span>
            <strong style={{ fontSize: '2rem', color: '#fff' }}>{summary.total_items}</strong>
          </div>
        </div>

        {/* Detailed Ingestion Logs */}
        <div style={{ textAlign: 'left' }}>
          <h3><FileText size={20} className="icon" /> Import Resolution Log</h3>
          <p style={{ fontSize: '0.85rem', marginTop: '-8px' }}>This audit trace documents every anomaly resolved and the action executed. Saving to database audit report...</p>
          
          <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '10%' }}>Row</th>
                  <th style={{ width: '40%' }}>Original Description</th>
                  <th style={{ width: '50%' }}>Action Executed</th>
                </tr>
              </thead>
              <tbody>
                {report.log_data.logs.map((log, lIdx) => (
                  <tr key={lIdx}>
                    <td><code>{log.csv_row}</code></td>
                    <td><strong>{log.description}</strong></td>
                    <td style={{ color: log.action.includes('Excluded') ? 'var(--text-secondary)' : 'var(--success)' }}>
                      {log.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => onImportSuccess()}
          >
            Go to Expenses Dashboard
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Wizard Header and Stepper */}
      <div className="glass-panel" style={{ padding: '16px 24px' }}>
        <div className="stepper">
          <div className={`step-node ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>1</div>
          <div className={`step-node ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>2</div>
          <div className={`step-node ${step >= 3 ? 'active' : ''}`}>3</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
          <span style={{ fontWeight: step === 1 ? 600 : 400, color: step === 1 ? 'var(--accent)' : 'inherit' }}>CSV Drag & Drop</span>
          <span style={{ fontWeight: step === 2 ? 600 : 400, color: step === 2 ? 'var(--accent)' : 'inherit' }}>Anomaly Resolution</span>
          <span style={{ fontWeight: step === 3 ? 600 : 400, color: step === 3 ? 'var(--accent)' : 'inherit' }}>Import Summary</span>
        </div>
      </div>

      {step === 1 && renderUploadStep()}
      {step === 2 && renderResolveStep()}
      {step === 3 && renderSuccessStep()}
    </div>
  );
}
