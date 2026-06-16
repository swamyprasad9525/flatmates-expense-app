import React, { useState, useEffect } from 'react';
import { PlusCircle, Wallet, History, Users, Settings, LogOut, ArrowRight, Check, AlertCircle, Trash2, Calendar, FileSpreadsheet, X, HelpCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function Dashboard({ groupId, token, user, onLogout, onTriggerImport }) {
  const [data, setData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [members, setMembers] = useState([]);
  
  // Modals state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedLedgerMember, setSelectedLedgerMember] = useState(null);
  
  // Form states
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    currency: 'INR',
    exchange_rate: '1',
    paid_by: user.id,
    split_type: 'equal',
    split_with: [],
    split_details: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [newSettlement, setNewSettlement] = useState({
    payer: user.id,
    payee: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [memberForm, setMemberForm] = useState({
    username: '',
    joined_date: new Date().toISOString().split('T')[0],
    left_date: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all group data
  const fetchData = async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { 'Authorization': `Token ${token}` };
      
      // Get Balances, Ledgers, Minimized
      const balRes = await fetch(`${API_BASE_URL}/api/groups/${groupId}/balances/`, { headers });
      const balData = await balRes.json();
      
      // Get Expenses
      const expRes = await fetch(`${API_BASE_URL}/api/groups/${groupId}/expenses/`, { headers });
      const expData = await expRes.json();
      
      // Get Settlements
      const setlRes = await fetch(`${API_BASE_URL}/api/groups/${groupId}/settlements/`, { headers });
      const setlData = await setlRes.json();

      // Get Members
      const memRes = await fetch(`${API_BASE_URL}/api/groups/${groupId}/members/`, { headers });
      const memData = await memRes.json();

      setData(balData);
      setExpenses(expData);
      setSettlements(setlData);
      setMembers(memData);

      // Auto-populate split_with checklist
      setNewExpense(prev => ({
        ...prev,
        split_with: memData.map(m => m.username)
      }));
    } catch (err) {
      setError("Failed to sync dashboard data with server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) {
      fetchData();
    }
  }, [groupId]);

  // Handle manual expense addition
  const handleAddExpense = async (e) => {
    e.preventDefault();
    setError(null);

    // Basic splits validation
    if (newExpense.split_with.length === 0) {
      setError("Please select at least one member to split the expense with.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/groups/${groupId}/expenses/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newExpense)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to add expense");
      }

      setShowExpenseModal(false);
      // Reset form
      setNewExpense({
        description: '',
        amount: '',
        currency: 'INR',
        exchange_rate: '1',
        paid_by: user.id,
        split_type: 'equal',
        split_with: members.map(m => m.username),
        split_details: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle manual settlement addition
  const handleAddSettlement = async (e) => {
    e.preventDefault();
    setError(null);

    if (!newSettlement.payee) {
      setError("Please select a payee to settle with.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/groups/${groupId}/settlements/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSettlement)
      });

      if (!response.ok) {
        throw new Error("Failed to record settlement");
      }

      setShowSettlementModal(false);
      setNewSettlement({
        payer: user.id,
        payee: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (id) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      await fetch(`${API_BASE_URL}/api/groups/${groupId}/expenses/${id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` }
      });
      fetchData();
    } catch (err) {
      setError("Failed to delete expense");
    }
  };

  // Delete Settlement
  const handleDeleteSettlement = async (id) => {
    if (!confirm("Are you sure you want to delete this settlement?")) return;
    try {
      await fetch(`${API_BASE_URL}/api/groups/${groupId}/settlements/${id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` }
      });
      fetchData();
    } catch (err) {
      setError("Failed to delete settlement");
    }
  };

  // Add/Update Group Member
  const handleSaveMember = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/groups/${groupId}/members/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(memberForm)
      });

      if (!response.ok) {
        throw new Error("Failed to save group member");
      }

      setMemberForm({
        username: '',
        joined_date: new Date().toISOString().split('T')[0],
        left_date: ''
      });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Helper toggle split checkboxes
  const handleSplitCheckboxChange = (uname) => {
    setNewExpense(prev => {
      const isSelected = prev.split_with.includes(uname);
      const updated = isSelected 
        ? prev.split_with.filter(name => name !== uname)
        : [...prev.split_with, uname];
      return { ...prev, split_with: updated };
    });
  };

  if (!data) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '100px 40px' }}>
        <h2 style={{ justifyContent: 'center' }}>Syncing Ledger...</h2>
        <p>Loading PostgreSQL calculations and minimizations.</p>
      </div>
    );
  }

  const { balances, ledgers, minimized_debts } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Panel */}
      <div className="glass-panel header-bar">
        <div>
          <h1 style={{ fontSize: '1.8rem', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wallet style={{ color: 'var(--accent)' }} /> Flat 404 Shared Ledger
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>Relational calculations backed by PostgreSQL database audit reports.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Log in: <strong>{user.username}</strong></span>
          <button className="btn btn-secondary" onClick={() => setShowMembersModal(true)}><Users size={16} /> Manage Members</button>
          <button className="btn btn-primary" onClick={onTriggerImport}><FileSpreadsheet size={16} /> Import CSV</button>
          <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={onLogout}><LogOut size={16} /></button>
        </div>
      </div>

      {error && (
        <div className="glass-panel" style={{ color: 'var(--danger)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Balances Dashboard Grid */}
      <div className="dashboard-grid">
        
        {/* Left column: Balances & Minimized Transactions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Flatmate Net Balances */}
          <div className="glass-panel">
            <h2><Users /> Flatmate Balances</h2>
            <p style={{ marginTop: '-8px', marginBottom: '20px', fontSize: '0.85rem' }}>Click on a flatmate to view their detailed itemized ledger (Rohan's no-magic-numbers view).</p>
            
            <div className="balances-row">
              {members.map(m => {
                const bal = balances[m.username] || 0;
                const isPos = bal >= 0;
                return (
                  <div 
                    key={m.id} 
                    className={`balance-card ${isPos ? 'positive' : 'negative'}`}
                    onClick={() => setSelectedLedgerMember(m.username)}
                  >
                    <div>
                      <span className="name">{m.display_name}</span>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {m.left_date ? `Left: ${m.left_date}` : `Active since ${m.joined_date}`}
                      </span>
                    </div>
                    <span className="amount">
                      {isPos ? `+₹${bal.toFixed(2)}` : `-₹${Math.abs(bal).toFixed(2)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Directed Settlements Graph */}
          <div className="glass-panel">
            <h2><Wallet /> Settlement Schedule (Aisha's View)</h2>
            <p style={{ marginTop: '-8px', marginBottom: '20px', fontSize: '0.85rem' }}>Aisha's request: Minimizes overall transaction count. Settles all group debts.</p>
            
            {minimized_debts.length === 0 ? (
              <div style={{ padding: '30px', background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed var(--panel-border)', borderRadius: '8px', textAlign: 'center' }}>
                <Check size={32} style={{ color: 'var(--success)', marginBottom: '8px' }} />
                <h4>All Clean! No outstanding debts in Flat 404.</h4>
              </div>
            ) : (
              <div className="settlement-schedule">
                {minimized_debts.map((tx, txIdx) => (
                  <div key={txIdx} className="settlement-item">
                    <div className="party">
                      <span className="name" style={{ color: 'var(--danger)' }}>{tx.from_user}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>owes and pays</span>
                      <span className="name" style={{ color: 'var(--success)' }}>{tx.to_user}</span>
                    </div>
                    <span className="amount-badge">₹{tx.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>

        {/* Right column: Quick action buttons & historical logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Quick Actions */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2>Actions</h2>
            <button className="btn btn-primary" onClick={() => setShowExpenseModal(true)}><PlusCircle size={18} /> Add Shared Expense</button>
            <button className="btn btn-secondary" onClick={() => setShowSettlementModal(true)}><Wallet size={18} /> Record Settlement Payment</button>
          </div>

          {/* Quick Stats */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2>Ledger Stats</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Expenses Count</span>
              <strong>{expenses.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Settlements Count</span>
              <strong>{settlements.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Ingested Volume</span>
              <strong style={{ color: 'var(--accent)' }}>
                ₹{expenses.reduce((acc, exp) => acc + parseFloat(exp.amount_in_inr), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>
          
        </div>
      </div>

      {/* Main Expense and Settlement Ledger Logs */}
      <div className="glass-panel">
        <h2 style={{ marginBottom: '16px' }}><History /> Transaction History</h2>
        
        <div className="transaction-history-grid">
          
          {/* Expenses Log */}
          <div>
            <h3>Shared Expenses</h3>
            <div className="table-wrapper" style={{ maxHeight: '400px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Detail</th>
                    <th>Payer</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id}>
                      <td style={{ fontSize: '0.85rem' }}>{exp.date}</td>
                      <td>
                        <strong>{exp.description}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Split: {exp.split_type}</div>
                      </td>
                      <td>{exp.paid_by_display_name}</td>
                      <td>
                        <strong>₹{parseFloat(exp.amount_in_inr).toFixed(2)}</strong>
                        {exp.currency !== 'INR' && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{exp.amount} {exp.currency}</div>}
                      </td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: '6px', color: 'var(--danger)' }} onClick={() => handleDeleteExpense(exp.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No expenses logged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Settlements Log */}
          <div>
            <h3>Recorded Settlements</h3>
            <div className="table-wrapper" style={{ maxHeight: '400px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Transfer</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map(setl => (
                    <tr key={setl.id}>
                      <td style={{ fontSize: '0.85rem' }}>{setl.date}</td>
                      <td>
                        <strong>{setl.payer_display_name}</strong> pays <strong>{setl.payee_display_name}</strong>
                        {setl.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Note: {setl.notes}</div>}
                      </td>
                      <td><strong style={{ color: 'var(--accent)' }}>₹{parseFloat(setl.amount).toFixed(2)}</strong></td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: '6px', color: 'var(--danger)' }} onClick={() => handleDeleteSettlement(setl.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {settlements.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No settlements logged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </div>

      {/* MODAL 1: Rohan's Detailed Itemized breakdown */}
      {selectedLedgerMember && (
        <div className="modal-overlay" onClick={() => setSelectedLedgerMember(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FileSpreadsheet style={{ color: 'var(--accent)' }} /> Itemized Ledger for {selectedLedgerMember}</h2>
              <button className="modal-close" onClick={() => setSelectedLedgerMember(null)}><X size={20} /></button>
            </div>
            
            <p style={{ marginTop: '-12px', marginBottom: '20px', fontSize: '0.9rem' }}>
              Rohan's Request: Verified line-by-line transactions contributing to a balance of 
              <strong style={{ color: balances[selectedLedgerMember] >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {balances[selectedLedgerMember] >= 0 ? ` +₹${(balances[selectedLedgerMember] || 0).toFixed(2)}` : ` -₹${Math.abs(balances[selectedLedgerMember] || 0).toFixed(2)}`}
              </strong>
            </p>

            <div className="table-wrapper" style={{ maxHeight: '450px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Transaction / Detail</th>
                    <th>Type</th>
                    <th>Split Value</th>
                    <th>Net Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgers[selectedLedgerMember]?.map((item, iIdx) => {
                    const isCredit = item.amount >= 0;
                    return (
                      <tr key={iIdx}>
                        <td style={{ fontSize: '0.85rem' }}>{item.date}</td>
                        <td>
                          <strong>{item.description}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Payer: {item.payer} (Total: ₹{item.total_amount.toFixed(2)})
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${
                            item.type.includes('paid') ? 'badge-success' : 'badge-danger'
                          }`}>
                            {item.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td><code>{item.split_value}</code></td>
                        <td style={{ color: isCredit ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                          {isCredit ? `+₹${item.amount.toFixed(2)}` : `-₹${Math.abs(item.amount).toFixed(2)}`}
                        </td>
                      </tr>
                    );
                  })}
                  {(!ledgers[selectedLedgerMember] || ledgers[selectedLedgerMember].length === 0) && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No transactions recorded for this member.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Manual Expense */}
      {showExpenseModal && (
        <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Group Expense</h2>
              <button className="modal-close" onClick={() => setShowExpenseModal(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="form-group">
                <label>Description</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={newExpense.description} 
                  onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Amount</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="form-control" 
                    value={newExpense.amount} 
                    onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Currency</label>
                  <select 
                    className="form-control" 
                    value={newExpense.currency} 
                    onChange={(e) => {
                      const cur = e.target.value;
                      setNewExpense(prev => ({ 
                        ...prev, 
                        currency: cur,
                        exchange_rate: cur === 'USD' ? '83' : '1'
                      }));
                    }}
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              {newExpense.currency === 'USD' && (
                <div className="form-group">
                  <label>Exchange Rate (to INR)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="form-control" 
                    value={newExpense.exchange_rate} 
                    onChange={(e) => setNewExpense(prev => ({ ...prev, exchange_rate: e.target.value }))}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Paid By</label>
                  <select 
                    className="form-control" 
                    value={newExpense.paid_by} 
                    onChange={(e) => setNewExpense(prev => ({ ...prev, paid_by: e.target.value }))}
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.user}>{m.display_name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Split Type</label>
                  <select 
                    className="form-control" 
                    value={newExpense.split_type} 
                    onChange={(e) => setNewExpense(prev => ({ ...prev, split_type: e.target.value }))}
                  >
                    <option value="equal">Equal</option>
                    <option value="share">Share</option>
                    <option value="percentage">Percentage</option>
                    <option value="unequal">Unequal</option>
                  </select>
                </div>
              </div>

              {/* Members selection list */}
              <div className="form-group">
                <label>Split With</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: 'rgba(0, 0, 0, 0.2)', padding: '12px', borderRadius: '8px' }}>
                  {members.map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, color: '#fff' }}>
                      <input 
                        type="checkbox" 
                        checked={newExpense.split_with.includes(m.username)}
                        onChange={() => handleSplitCheckboxChange(m.username)}
                      />
                      {m.display_name}
                    </label>
                  ))}
                </div>
              </div>

              {newExpense.split_type !== 'equal' && (
                <div className="form-group">
                  <label>Split Details (Semicolon separated values)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={newExpense.split_details} 
                    onChange={(e) => setNewExpense(prev => ({ ...prev, split_details: e.target.value }))}
                    placeholder={
                      newExpense.split_type === 'share' ? "e.g. Aisha 2; Rohan 1; Priya 1" :
                      newExpense.split_type === 'percentage' ? "e.g. Aisha 30; Rohan 40; Priya 30" :
                      "e.g. Aisha 700; Rohan 400"
                    }
                    required
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={newExpense.date} 
                    onChange={(e) => setNewExpense(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={newExpense.notes} 
                    onChange={(e) => setNewExpense(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Record Settlement */}
      {showSettlementModal && (
        <div className="modal-overlay" onClick={() => setShowSettlementModal(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Record Settlement</h2>
              <button className="modal-close" onClick={() => setShowSettlementModal(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddSettlement} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="form-group">
                <label>Paid By (Payer)</label>
                <select 
                  className="form-control" 
                  value={newSettlement.payer} 
                  onChange={(e) => setNewSettlement(prev => ({ ...prev, payer: e.target.value }))}
                >
                  {members.map(m => (
                    <option key={m.id} value={m.user}>{m.display_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Paid To (Payee)</label>
                <select 
                  className="form-control" 
                  value={newSettlement.payee} 
                  onChange={(e) => setNewSettlement(prev => ({ ...prev, payee: e.target.value }))}
                  required
                >
                  <option value="">-- Select --</option>
                  {members.filter(m => m.user.toString() !== newSettlement.payer.toString()).map(m => (
                    <option key={m.id} value={m.user}>{m.display_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Amount (in INR)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-control" 
                  value={newSettlement.amount} 
                  onChange={(e) => setNewSettlement(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Date</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={newSettlement.date} 
                  onChange={(e) => setNewSettlement(prev => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Notes</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={newSettlement.notes} 
                  placeholder="e.g. Paid Rohan via UPI"
                  onChange={(e) => setNewSettlement(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettlementModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Settlement</button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Manage Members & Membership Dates */}
      {showMembersModal && (
        <div className="modal-overlay" onClick={() => setShowMembersModal(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: '750px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Group Members & Active Dates</h2>
              <button className="modal-close" onClick={() => setShowMembersModal(false)}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Member list & dates */}
              <div>
                <h3>Active Members List</h3>
                <div className="table-wrapper" style={{ maxHeight: '350px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Joined</th>
                        <th>Left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(m => (
                        <tr key={m.id}>
                          <td><strong>{m.display_name}</strong></td>
                          <td style={{ fontSize: '0.8rem' }}>{m.joined_date}</td>
                          <td style={{ fontSize: '0.8rem', color: m.left_date ? 'var(--danger)' : 'var(--text-secondary)' }}>
                            {m.left_date || 'Present'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add/Edit member form */}
              <div>
                <h3>Configure Membership</h3>
                <p style={{ fontSize: '0.8rem' }}>Add a new flatmate or modify membership duration dates (joined/left) for date boundary checks.</p>
                
                <form onSubmit={handleSaveMember} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                  <div className="form-group">
                    <label>Username (System matches this)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={memberForm.username} 
                      placeholder="e.g. Sam"
                      onChange={(e) => setMemberForm(prev => ({ ...prev, username: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Joined Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={memberForm.joined_date} 
                      onChange={(e) => setMemberForm(prev => ({ ...prev, joined_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Left Date (Optional)</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={memberForm.left_date} 
                      onChange={(e) => setMemberForm(prev => ({ ...prev, left_date: e.target.value }))}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>Save Member Config</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
