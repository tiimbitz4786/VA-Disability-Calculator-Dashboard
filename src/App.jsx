import React, { useState, useEffect, useMemo } from 'react';

// Your Google Sheet ID
const SHEET_ID = '1-e37SswyBOy7Sc9-BEJHrBOpMbty_TQHOW1qfPNqqNg';
const SHEET_NAME = 'Sheet1';
const REFRESH_INTERVAL = 60000; // Refresh every 60 seconds

// Sample data for preview (will be replaced by real data when deployed)
const SAMPLE_DATA = [
  { type: 'lead_submission', sessionId: 'abc123', 'First Name': 'John', 'Last Name': 'Smith', 'Phone': '5551234567', 'Current Rating': '30', 'Projected Rating': '70', 'Monthly Increase': '1200' },
  { type: 'lead_submission', sessionId: 'def456', 'First Name': 'Jane', 'Last Name': 'Doe', 'Phone': '5559876543', 'Current Rating': '50', 'Projected Rating': '90', 'Monthly Increase': '1800' },
  { type: 'lead_submission', sessionId: 'ghi789', 'First Name': 'Bob', 'Last Name': 'Wilson', 'Phone': '5555555555', 'Current Rating': '20', 'Projected Rating': '60', 'Monthly Increase': '900' },
  { type: 'funnel_tracking', sessionId: 'abc123', step: '1_started', 'Current Rating': '0' },
  { type: 'funnel_tracking', sessionId: 'abc123', step: '6_viewed_results', 'Current Rating': '30', 'Projected Rating': '70' },
  { type: 'funnel_tracking', sessionId: 'def456', step: '1_started', 'Current Rating': '0' },
  { type: 'funnel_tracking', sessionId: 'def456', step: '6_viewed_results', 'Current Rating': '50', 'Projected Rating': '90' },
  { type: 'funnel_tracking', sessionId: 'ghi789', step: '1_started', 'Current Rating': '0' },
  { type: 'funnel_tracking', sessionId: 'ghi789', step: '6_viewed_results', 'Current Rating': '20', 'Projected Rating': '60' },
  { type: 'funnel_tracking', sessionId: 'jkl012', step: '1_started', 'Current Rating': '0' },
  { type: 'funnel_tracking', sessionId: 'jkl012', step: '6_viewed_results', 'Current Rating': '40', 'Projected Rating': '70' },
  { type: 'funnel_tracking', sessionId: 'mno345', step: '1_started', 'Current Rating': '0' },
];

export default function Dashboard() {
  const [data, setData] = useState(SAMPLE_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [usingLiveData, setUsingLiveData] = useState(false);
  
  // Lead status tracking (stored in localStorage)
  const [leadStatuses, setLeadStatuses] = useState(() => {
    try {
      const saved = localStorage.getItem('va_lead_statuses');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  // Ad spend tracking (stored in localStorage)
  const [adSpend, setAdSpend] = useState(() => {
    try {
      const saved = localStorage.getItem('va_ad_spend');
      return saved ? parseFloat(saved) : 0;
    } catch {
      return 0;
    }
  });
  const [spendInput, setSpendInput] = useState('');
  const [showSpendEdit, setShowSpendEdit] = useState(false);

  // Save lead statuses to localStorage
  useEffect(() => {
    localStorage.setItem('va_lead_statuses', JSON.stringify(leadStatuses));
  }, [leadStatuses]);

  // Save ad spend to localStorage
  useEffect(() => {
    localStorage.setItem('va_ad_spend', adSpend.toString());
  }, [adSpend]);

  // Fetch data from Google Sheets
  const fetchData = async () => {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;
      const response = await fetch(url);
      const text = await response.text();
      
      const jsonString = text.substring(47, text.length - 2);
      const json = JSON.parse(jsonString);
      
      const headers = json.table.cols.map(col => col.label || '');
      const rows = json.table.rows.map(row => {
        const obj = {};
        row.c.forEach((cell, i) => {
          obj[headers[i]] = cell ? (cell.v || '') : '';
        });
        return obj;
      });
      
      setData(rows);
      setLastUpdated(new Date());
      setError(null);
      setUsingLiveData(true);
    } catch (err) {
      console.error('Error fetching data:', err);
      if (!usingLiveData) {
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Toggle lead status
  const toggleStatus = (sessionId, status) => {
    setLeadStatuses(prev => ({
      ...prev,
      [sessionId]: {
        ...prev[sessionId],
        [status]: !prev[sessionId]?.[status]
      }
    }));
  };

  const analytics = useMemo(() => {
    if (data.length === 0) {
      return {
        funnel: { started: 0, ratingSelected: 0, conditionsSelected: 0, questionsCompleted: 0, viewedResults: 0, clickedReview: 0, submitted: 0 },
        leads: [],
        dropoffs: { beforeRating: 0, beforeConditions: 0, beforeQuestions: 0, beforeResults: 0, beforeClick: 0, beforeSubmit: 0 },
        ratingDistribution: {},
        totalSessions: 0
      };
    }

    const sessions = {};
    
    data.forEach(row => {
      const sessionId = row.sessionId || row['Session Id'] || row['sessionId'];
      if (!sessionId) return;
      
      if (!sessions[sessionId]) {
        sessions[sessionId] = {
          steps: new Set(),
          currentRating: 0,
          projectedRating: 0,
          monthlyIncrease: 0,
          isLead: false,
          timestamp: row.timestamp || row.Timestamp
        };
      }
      
      const step = row.step || row.Step;
      if (step) {
        sessions[sessionId].steps.add(step);
      }
      
      const type = row.type || row.Type;
      if (type === 'lead_submission') {
        sessions[sessionId].isLead = true;
        sessions[sessionId].sessionId = sessionId;
        sessions[sessionId].firstName = row['First Name'] || row.firstName || '';
        sessions[sessionId].lastName = row['Last Name'] || row.lastName || '';
        sessions[sessionId].email = row.Email || row.email || '';
        sessions[sessionId].phone = row.Phone || row.phone || '';
        sessions[sessionId].conditions = row.Conditions || row.conditions || '';
        sessions[sessionId].submittedAt = row['Submitted At'] || row.submittedAt || '';
      }
      
      const currentRating = row['Current Rating'] || row.currentRating;
      const projectedRating = row['Projected Rating'] || row.projectedRating;
      const monthlyIncrease = row['Monthly Increase'] || row.monthlyIncrease;
      
      if (currentRating) {
        sessions[sessionId].currentRating = parseInt(currentRating) || 0;
      }
      if (projectedRating) {
        sessions[sessionId].projectedRating = parseInt(projectedRating) || 0;
      }
      if (monthlyIncrease) {
        sessions[sessionId].monthlyIncrease = parseFloat(monthlyIncrease) || 0;
      }
    });
    
    const funnel = {
      started: 0,
      ratingSelected: 0,
      conditionsSelected: 0,
      questionsCompleted: 0,
      viewedResults: 0,
      clickedReview: 0,
      submitted: 0
    };
    
    const leads = [];
    const dropoffs = {
      beforeRating: 0,
      beforeConditions: 0,
      beforeQuestions: 0,
      beforeResults: 0,
      beforeClick: 0,
      beforeSubmit: 0
    };
    
    const ratingDistribution = {};
    
    Object.entries(sessions).forEach(([id, session]) => {
      const steps = session.steps;
      
      if (steps.has('1_started')) funnel.started++;
      if (steps.has('2_rating_selected')) funnel.ratingSelected++;
      if (steps.has('3_conditions_selected')) funnel.conditionsSelected++;
      if (steps.has('5_all_questions_completed')) funnel.questionsCompleted++;
      if (steps.has('6_viewed_results')) funnel.viewedResults++;
      if (steps.has('7_clicked_get_review')) funnel.clickedReview++;
      if (steps.has('8_lead_submitted')) funnel.submitted++;
      
      if (session.isLead) {
        leads.push(session);
      }
      
      if (steps.has('1_started') && !steps.has('2_rating_selected')) {
        dropoffs.beforeRating++;
      } else if (steps.has('2_rating_selected') && !steps.has('3_conditions_selected')) {
        dropoffs.beforeConditions++;
      } else if (steps.has('3_conditions_selected') && !steps.has('5_all_questions_completed')) {
        dropoffs.beforeQuestions++;
      } else if (steps.has('5_all_questions_completed') && !steps.has('6_viewed_results')) {
        dropoffs.beforeResults++;
      } else if (steps.has('6_viewed_results') && !steps.has('7_clicked_get_review')) {
        dropoffs.beforeClick++;
      } else if (steps.has('7_clicked_get_review') && !steps.has('8_lead_submitted')) {
        dropoffs.beforeSubmit++;
      }
      
      if (session.currentRating !== undefined && steps.has('2_rating_selected')) {
        const rating = session.currentRating;
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
      }
    });
    
    return { funnel, leads, dropoffs, ratingDistribution, totalSessions: Object.keys(sessions).length };
  }, [data]);

  // Calculate lead quality metrics
  const leadMetrics = useMemo(() => {
    const totalLeads = analytics.leads.length;
    const wantedLeads = analytics.leads.filter(l => leadStatuses[l.sessionId]?.wanted).length;
    const retainedLeads = analytics.leads.filter(l => leadStatuses[l.sessionId]?.retained).length;
    
    return {
      total: totalLeads,
      wanted: wantedLeads,
      retained: retainedLeads,
      wantedRate: totalLeads > 0 ? (wantedLeads / totalLeads * 100).toFixed(1) : 0,
      retainedRate: totalLeads > 0 ? (retainedLeads / totalLeads * 100).toFixed(1) : 0,
      conversionRate: wantedLeads > 0 ? (retainedLeads / wantedLeads * 100).toFixed(1) : 0
    };
  }, [analytics.leads, leadStatuses]);

  // Calculate cost metrics
  const costMetrics = useMemo(() => {
    return {
      costPerLead: leadMetrics.total > 0 ? (adSpend / leadMetrics.total).toFixed(2) : 0,
      costPerWanted: leadMetrics.wanted > 0 ? (adSpend / leadMetrics.wanted).toFixed(2) : 0,
      costPerCase: leadMetrics.retained > 0 ? (adSpend / leadMetrics.retained).toFixed(2) : 0
    };
  }, [adSpend, leadMetrics]);

  const theme = {
    purple: '#5D3A8E',
    purpleLight: '#F5F0FF',
    green: '#22C55E',
    greenLight: '#DCFCE7',
    red: '#EF4444',
    redLight: '#FEE2E2',
    yellow: '#F59E0B',
    yellowLight: '#FEF3C7',
    blue: '#3B82F6',
    blueLight: '#DBEAFE',
    gray: '#6B7280',
    grayLight: '#F3F4F6',
    grayDark: '#1F2937'
  };

  const FunnelBar = ({ label, count, total, color }) => {
    const percentage = total > 0 ? (count / total * 100).toFixed(1) : 0;
    const width = total > 0 ? (count / total * 100) : 0;
    
    return (
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', color: theme.grayDark }}>{label}</span>
          <span style={{ fontSize: '14px', fontWeight: '600' }}>{count} <span style={{ color: theme.gray }}>({percentage}%)</span></span>
        </div>
        <div style={{ height: '24px', background: theme.grayLight, borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ 
            height: '100%', 
            width: `${width}%`, 
            background: color,
            borderRadius: '6px',
            transition: 'width 0.5s ease'
          }} />
        </div>
      </div>
    );
  };

  const StatCard = ({ title, value, subtitle, color, icon }) => (
    <div style={{ 
      background: 'white', 
      borderRadius: '12px', 
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      flex: 1,
      minWidth: '140px'
    }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '28px', fontWeight: '800', color: color }}>{value}</div>
      <div style={{ fontSize: '14px', fontWeight: '600', color: theme.grayDark }}>{title}</div>
      {subtitle && <div style={{ fontSize: '12px', color: theme.gray, marginTop: '4px' }}>{subtitle}</div>}
    </div>
  );

  const StatusButton = ({ active, onClick, children, color, activeColor }) => (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: '6px',
        border: 'none',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        background: active ? activeColor : theme.grayLight,
        color: active ? 'white' : theme.gray,
        transition: 'all 0.2s ease'
      }}
    >
      {children}
    </button>
  );

  const conversionRate = analytics.funnel.started > 0 
    ? (analytics.funnel.submitted / analytics.funnel.started * 100).toFixed(1) 
    : 0;

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: theme.grayLight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <div style={{ fontSize: '18px', color: theme.gray }}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: theme.grayLight,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '24px'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', color: theme.purple, marginBottom: '4px' }}>
              VA Calculator Dashboard
            </h1>
            <p style={{ color: theme.gray }}>Funnel Analytics, Lead Tracking & ROI</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px',
              background: usingLiveData ? 'white' : theme.yellowLight,
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              color: usingLiveData ? theme.gray : '#92400E'
            }}>
              <span style={{ 
                width: '8px', 
                height: '8px', 
                background: usingLiveData ? theme.green : theme.yellow, 
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }} />
              {usingLiveData ? 'Live data • Auto-refreshes every 60s' : 'Sample data (deploy to see live)'}
            </div>
            {lastUpdated && (
              <div style={{ fontSize: '12px', color: theme.gray, marginTop: '4px' }}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Ad Spend Input */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '16px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>💰</span>
            <div>
              <div style={{ fontWeight: '700', color: theme.grayDark }}>Total Ad Spend</div>
              <div style={{ fontSize: '12px', color: theme.gray }}>Enter your Facebook ad spend to calculate ROI</div>
            </div>
          </div>
          
          {showSpendEdit ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px', color: theme.grayDark }}>$</span>
              <input
                type="number"
                value={spendInput}
                onChange={e => setSpendInput(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '120px',
                  padding: '10px 12px',
                  border: `2px solid ${theme.purple}`,
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
                autoFocus
              />
              <button
                onClick={() => {
                  setAdSpend(parseFloat(spendInput) || 0);
                  setShowSpendEdit(false);
                }}
                style={{
                  padding: '10px 16px',
                  background: theme.green,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setSpendInput(adSpend.toString());
                  setShowSpendEdit(false);
                }}
                style={{
                  padding: '10px 16px',
                  background: theme.grayLight,
                  color: theme.gray,
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px', fontWeight: '800', color: theme.purple }}>
                ${adSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <button
                onClick={() => {
                  setSpendInput(adSpend.toString());
                  setShowSpendEdit(true);
                }}
                style={{
                  padding: '8px 16px',
                  background: theme.purpleLight,
                  color: theme.purple,
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Top Stats Row */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <StatCard 
            icon="👆" 
            title="Sessions" 
            value={analytics.funnel.started}
            subtitle="Started calculator"
            color={theme.purple}
          />
          <StatCard 
            icon="📝" 
            title="Leads" 
            value={leadMetrics.total}
            subtitle={`${conversionRate}% conversion`}
            color={theme.blue}
          />
          <StatCard 
            icon="✅" 
            title="Wanted" 
            value={leadMetrics.wanted}
            subtitle={`${leadMetrics.wantedRate}% of leads`}
            color={theme.yellow}
          />
          <StatCard 
            icon="🎉" 
            title="Retained" 
            value={leadMetrics.retained}
            subtitle={`${leadMetrics.conversionRate}% of wanted`}
            color={theme.green}
          />
        </div>

        {/* Cost Metrics Row */}
        {adSpend > 0 && (
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            marginBottom: '24px'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: theme.grayDark, marginBottom: '16px' }}>
              💵 Cost Metrics
            </h2>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px', textAlign: 'center', padding: '16px', background: theme.blueLight, borderRadius: '12px' }}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: theme.blue }}>${costMetrics.costPerLead}</div>
                <div style={{ fontSize: '14px', color: theme.blue, fontWeight: '600' }}>Cost per Lead</div>
              </div>
              <div style={{ flex: 1, minWidth: '150px', textAlign: 'center', padding: '16px', background: theme.yellowLight, borderRadius: '12px' }}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: theme.yellow }}>${costMetrics.costPerWanted}</div>
                <div style={{ fontSize: '14px', color: '#92400E', fontWeight: '600' }}>Cost per Wanted</div>
              </div>
              <div style={{ flex: 1, minWidth: '150px', textAlign: 'center', padding: '16px', background: theme.greenLight, borderRadius: '12px' }}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: theme.green }}>${costMetrics.costPerCase}</div>
                <div style={{ fontSize: '14px', color: '#166534', fontWeight: '600' }}>Cost per Case</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
          
          {/* Lead Management */}
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: theme.grayDark, marginBottom: '20px' }}>
              📋 Lead Management
            </h2>
            
            {analytics.leads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: theme.gray }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <div>No leads yet</div>
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {analytics.leads.map((lead, i) => {
                  const status = leadStatuses[lead.sessionId] || {};
                  return (
                    <div key={i} style={{ 
                      padding: '16px',
                      background: status.retained ? theme.greenLight : status.wanted ? theme.yellowLight : theme.grayLight,
                      borderRadius: '12px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontWeight: '700', color: theme.grayDark, fontSize: '16px' }}>
                            {lead.firstName} {lead.lastName}
                          </div>
                          <div style={{ fontSize: '14px', color: theme.gray }}>{lead.phone}</div>
                          {lead.conditions && (
                            <div style={{ fontSize: '12px', color: theme.gray, marginTop: '4px' }}>{lead.conditions}</div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ 
                            background: theme.purple, 
                            color: 'white', 
                            padding: '4px 10px', 
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {lead.currentRating}% → {lead.projectedRating}%
                          </div>
                          {lead.monthlyIncrease > 0 && (
                            <div style={{ fontSize: '13px', color: theme.green, marginTop: '4px', fontWeight: '600' }}>
                              +${lead.monthlyIncrease.toFixed(0)}/mo
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Status Buttons */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <StatusButton
                          active={status.wanted}
                          onClick={() => toggleStatus(lead.sessionId, 'wanted')}
                          activeColor={theme.yellow}
                        >
                          {status.wanted ? '✓ Wanted' : 'Mark Wanted'}
                        </StatusButton>
                        <StatusButton
                          active={status.retained}
                          onClick={() => toggleStatus(lead.sessionId, 'retained')}
                          activeColor={theme.green}
                        >
                          {status.retained ? '✓ Retained' : 'Mark Retained'}
                        </StatusButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Funnel Visualization */}
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: theme.grayDark, marginBottom: '20px' }}>
              📊 Conversion Funnel
            </h2>
            
            <FunnelBar 
              label="1. Started Calculator" 
              count={analytics.funnel.started} 
              total={analytics.funnel.started}
              color={theme.purple}
            />
            <FunnelBar 
              label="2. Selected Rating" 
              count={analytics.funnel.ratingSelected} 
              total={analytics.funnel.started}
              color={theme.purple}
            />
            <FunnelBar 
              label="3. Selected Conditions" 
              count={analytics.funnel.conditionsSelected} 
              total={analytics.funnel.started}
              color={theme.purple}
            />
            <FunnelBar 
              label="4. Completed Questions" 
              count={analytics.funnel.questionsCompleted} 
              total={analytics.funnel.started}
              color={theme.yellow}
            />
            <FunnelBar 
              label="5. Viewed Results" 
              count={analytics.funnel.viewedResults} 
              total={analytics.funnel.started}
              color={theme.yellow}
            />
            <FunnelBar 
              label="6. Clicked CTA" 
              count={analytics.funnel.clickedReview} 
              total={analytics.funnel.started}
              color={theme.green}
            />
            <FunnelBar 
              label="7. Submitted Lead" 
              count={analytics.funnel.submitted} 
              total={analytics.funnel.started}
              color={theme.green}
            />
          </div>

          {/* Pipeline Summary */}
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: theme.grayDark, marginBottom: '20px' }}>
              🎯 Lead Pipeline
            </h2>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              {/* Leads */}
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '50%', 
                  background: theme.blueLight, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 8px'
                }}>
                  <span style={{ fontSize: '24px', fontWeight: '800', color: theme.blue }}>{leadMetrics.total}</span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: theme.gray }}>Leads</div>
              </div>
              
              <div style={{ color: theme.gray, fontSize: '20px' }}>→</div>
              
              {/* Wanted */}
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '50%', 
                  background: theme.yellowLight, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 8px'
                }}>
                  <span style={{ fontSize: '24px', fontWeight: '800', color: theme.yellow }}>{leadMetrics.wanted}</span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: theme.gray }}>Wanted</div>
                <div style={{ fontSize: '11px', color: theme.gray }}>{leadMetrics.wantedRate}%</div>
              </div>
              
              <div style={{ color: theme.gray, fontSize: '20px' }}>→</div>
              
              {/* Retained */}
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '50%', 
                  background: theme.greenLight, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 8px'
                }}>
                  <span style={{ fontSize: '24px', fontWeight: '800', color: theme.green }}>{leadMetrics.retained}</span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: theme.gray }}>Retained</div>
                <div style={{ fontSize: '11px', color: theme.gray }}>{leadMetrics.conversionRate}%</div>
              </div>
            </div>
            
            {/* Summary Stats */}
            <div style={{ 
              background: theme.grayLight, 
              borderRadius: '12px', 
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: theme.gray }}>Lead → Wanted</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: theme.grayDark }}>{leadMetrics.wantedRate}%</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: theme.gray }}>Wanted → Retained</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: theme.grayDark }}>{leadMetrics.conversionRate}%</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: theme.gray }}>Overall Sign Rate</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: theme.green }}>{leadMetrics.retainedRate}%</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: theme.gray }}>Leads to Close</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: theme.grayDark }}>
                  {leadMetrics.retained > 0 ? (leadMetrics.total / leadMetrics.retained).toFixed(1) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Drop-off Analysis */}
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: theme.grayDark, marginBottom: '20px' }}>
              🚪 Where People Leave
            </h2>
            
            {[
              { label: 'Before selecting rating', count: analytics.dropoffs.beforeRating, emoji: '😕' },
              { label: 'Before selecting conditions', count: analytics.dropoffs.beforeConditions, emoji: '🤔' },
              { label: 'During questions', count: analytics.dropoffs.beforeQuestions, emoji: '😩' },
              { label: 'Before seeing results', count: analytics.dropoffs.beforeResults, emoji: '😤' },
              { label: 'Saw results, didn\'t click CTA', count: analytics.dropoffs.beforeClick, emoji: '🎯' },
              { label: 'Clicked CTA, didn\'t submit', count: analytics.dropoffs.beforeSubmit, emoji: '😱' },
            ].sort((a, b) => b.count - a.count).map((item, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '12px',
                background: item.count > 0 ? theme.redLight : theme.grayLight,
                borderRadius: '8px',
                marginBottom: '8px'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{item.emoji}</span>
                  <span style={{ color: theme.grayDark }}>{item.label}</span>
                </span>
                <span style={{ 
                  fontWeight: '700', 
                  color: item.count > 0 ? theme.red : theme.gray,
                  background: item.count > 0 ? 'white' : 'transparent',
                  padding: '4px 12px',
                  borderRadius: '12px'
                }}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '24px', color: theme.gray, fontSize: '12px' }}>
          <p>Lead statuses and ad spend are saved in your browser</p>
          <p style={{ marginTop: '4px' }}>Hiller Comerford Injury & Disability Law</p>
        </div>
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
