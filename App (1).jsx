import React, { useState, useEffect, useMemo } from 'react';

// Your Google Sheet ID
const SHEET_ID = '1-e37SswyBOy7Sc9-BEJHrBOpMbty_TQHOW1qfPNqqNg';
const SHEET_NAME = 'Sheet1';
const REFRESH_INTERVAL = 60000; // Refresh every 60 seconds

// Sample data for preview (will be replaced by real data when deployed)
const SAMPLE_DATA = [
  { type: 'funnel_tracking', sessionId: 'abc123', step: '1_started', 'Current Rating': '0' },
  { type: 'funnel_tracking', sessionId: 'abc123', step: '2_rating_selected', 'Current Rating': '30' },
  { type: 'funnel_tracking', sessionId: 'abc123', step: '3_conditions_selected', 'Current Rating': '30' },
  { type: 'funnel_tracking', sessionId: 'abc123', step: '5_all_questions_completed', 'Current Rating': '30' },
  { type: 'funnel_tracking', sessionId: 'abc123', step: '6_viewed_results', 'Current Rating': '30', 'Projected Rating': '70', 'Monthly Increase': '1200' },
  { type: 'funnel_tracking', sessionId: 'abc123', step: '7_clicked_get_review', 'Current Rating': '30' },
  { type: 'funnel_tracking', sessionId: 'abc123', step: '8_lead_submitted', 'Current Rating': '30' },
  { type: 'lead_submission', sessionId: 'abc123', 'First Name': 'John', 'Last Name': 'Smith', 'Email': 'john@test.com', 'Phone': '555-1234', 'Current Rating': '30', 'Projected Rating': '70', 'Monthly Increase': '1200' },
  { type: 'funnel_tracking', sessionId: 'def456', step: '1_started', 'Current Rating': '0' },
  { type: 'funnel_tracking', sessionId: 'def456', step: '2_rating_selected', 'Current Rating': '50' },
  { type: 'funnel_tracking', sessionId: 'def456', step: '3_conditions_selected', 'Current Rating': '50' },
  { type: 'funnel_tracking', sessionId: 'def456', step: '5_all_questions_completed', 'Current Rating': '50' },
  { type: 'funnel_tracking', sessionId: 'def456', step: '6_viewed_results', 'Current Rating': '50', 'Projected Rating': '80', 'Monthly Increase': '800' },
  { type: 'funnel_tracking', sessionId: 'ghi789', step: '1_started', 'Current Rating': '0' },
  { type: 'funnel_tracking', sessionId: 'ghi789', step: '2_rating_selected', 'Current Rating': '70' },
  { type: 'funnel_tracking', sessionId: 'ghi789', step: '3_conditions_selected', 'Current Rating': '70' },
  { type: 'funnel_tracking', sessionId: 'jkl012', step: '1_started', 'Current Rating': '0' },
  { type: 'funnel_tracking', sessionId: 'jkl012', step: '2_rating_selected', 'Current Rating': '10' },
  { type: 'funnel_tracking', sessionId: 'mno345', step: '1_started', 'Current Rating': '0' },
];

export default function Dashboard() {
  const [data, setData] = useState(SAMPLE_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [usingLiveData, setUsingLiveData] = useState(false);

  // Fetch data from Google Sheets
  const fetchData = async () => {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;
      const response = await fetch(url);
      const text = await response.text();
      
      // Google returns JSONP, so we need to extract the JSON
      const jsonString = text.substring(47, text.length - 2);
      const json = JSON.parse(jsonString);
      
      // Parse the data
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
      // Keep using sample data if fetch fails
      if (!usingLiveData) {
        setError(null); // Don't show error if we have sample data
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and set up auto-refresh
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

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

    // Get unique sessions
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
        sessions[sessionId].firstName = row['First Name'] || row.firstName || '';
        sessions[sessionId].lastName = row['Last Name'] || row.lastName || '';
        sessions[sessionId].email = row.Email || row.email || '';
        sessions[sessionId].phone = row.Phone || row.phone || '';
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
    
    // Count funnel steps
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
      
      // Track where people dropped off
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
      
      // Rating distribution
      if (session.currentRating !== undefined && steps.has('2_rating_selected')) {
        const rating = session.currentRating;
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
      }
    });
    
    return { funnel, leads, dropoffs, ratingDistribution, totalSessions: Object.keys(sessions).length };
  }, [data]);

  const theme = {
    purple: '#5D3A8E',
    purpleLight: '#F5F0FF',
    green: '#22C55E',
    greenLight: '#DCFCE7',
    red: '#EF4444',
    redLight: '#FEE2E2',
    yellow: '#F59E0B',
    yellowLight: '#FEF3C7',
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
      minWidth: '150px'
    }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '32px', fontWeight: '800', color: color }}>{value}</div>
      <div style={{ fontSize: '14px', fontWeight: '600', color: theme.grayDark }}>{title}</div>
      {subtitle && <div style={{ fontSize: '12px', color: theme.gray, marginTop: '4px' }}>{subtitle}</div>}
    </div>
  );

  const conversionRate = analytics.funnel.started > 0 
    ? (analytics.funnel.submitted / analytics.funnel.started * 100).toFixed(1) 
    : 0;
    
  const resultsToLeadRate = analytics.funnel.viewedResults > 0
    ? (analytics.funnel.submitted / analytics.funnel.viewedResults * 100).toFixed(1)
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

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: theme.grayLight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '24px'
      }}>
        <div style={{ 
          textAlign: 'center', 
          background: 'white', 
          padding: '40px', 
          borderRadius: '16px',
          maxWidth: '500px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <div style={{ fontSize: '18px', color: theme.red, marginBottom: '12px' }}>Error Loading Data</div>
          <div style={{ color: theme.gray, marginBottom: '20px' }}>{error}</div>
          <button 
            onClick={fetchData}
            style={{
              padding: '12px 24px',
              background: theme.purple,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
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
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', color: theme.purple, marginBottom: '4px' }}>
              VA Calculator Dashboard
            </h1>
            <p style={{ color: theme.gray }}>Funnel Analytics & Lead Tracking</p>
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

        {/* Top Stats */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <StatCard 
            icon="👆" 
            title="Total Sessions" 
            value={analytics.funnel.started}
            subtitle="People who started"
            color={theme.purple}
          />
          <StatCard 
            icon="👀" 
            title="Viewed Results" 
            value={analytics.funnel.viewedResults}
            subtitle={`${(analytics.funnel.viewedResults / analytics.funnel.started * 100 || 0).toFixed(0)}% completion`}
            color={theme.yellow}
          />
          <StatCard 
            icon="✅" 
            title="Leads Submitted" 
            value={analytics.funnel.submitted}
            subtitle={`${conversionRate}% conversion`}
            color={theme.green}
          />
          <StatCard 
            icon="📊" 
            title="Results → Lead" 
            value={`${resultsToLeadRate}%`}
            subtitle="Post-results conversion"
            color={theme.purple}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
          
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
              label="6. Clicked 'Connect'" 
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
            
            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              background: theme.yellowLight, 
              borderRadius: '8px',
              fontSize: '13px',
              color: '#92400E'
            }}>
              <strong>💡 Insight:</strong> {analytics.dropoffs.beforeClick > analytics.dropoffs.beforeSubmit 
                ? "Most people leave after seeing results without clicking. Consider making your CTA more compelling."
                : analytics.dropoffs.beforeSubmit > 0 
                  ? "People are clicking but not submitting. Consider reducing form fields."
                  : "Your funnel is performing well!"}
            </div>
          </div>

          {/* Current Rating Distribution */}
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: theme.grayDark, marginBottom: '20px' }}>
              📈 Current Ratings of Visitors
            </h2>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(rating => {
                const count = analytics.ratingDistribution[rating] || 0;
                const maxCount = Math.max(...Object.values(analytics.ratingDistribution), 1);
                const height = count > 0 ? (count / maxCount * 80) + 20 : 20;
                
                return (
                  <div key={rating} style={{ textAlign: 'center', flex: '1', minWidth: '40px' }}>
                    <div style={{ 
                      height: '100px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'flex-end' 
                    }}>
                      <div style={{ 
                        height: `${height}%`,
                        background: count > 0 ? theme.purple : theme.grayLight,
                        borderRadius: '4px 4px 0 0',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        paddingTop: '4px',
                        color: count > 0 ? 'white' : theme.gray,
                        fontWeight: '600',
                        fontSize: '12px'
                      }}>
                        {count > 0 ? count : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: theme.gray, marginTop: '4px' }}>{rating}%</div>
                  </div>
                );
              })}
            </div>
            
            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              background: theme.purpleLight, 
              borderRadius: '8px',
              fontSize: '13px',
              color: theme.purple
            }}>
              <strong>💡 Insight:</strong> Most visitors have a {
                Object.entries(analytics.ratingDistribution)
                  .sort((a, b) => b[1] - a[1])[0]?.[0] || '0'
              }% rating. Target your ads accordingly.
            </div>
          </div>

          {/* Recent Leads */}
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: theme.grayDark, marginBottom: '20px' }}>
              ✅ Recent Leads
            </h2>
            
            {analytics.leads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: theme.gray }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <div>No leads yet. Keep optimizing!</div>
              </div>
            ) : (
              analytics.leads.slice(0, 10).map((lead, i) => (
                <div key={i} style={{ 
                  padding: '16px',
                  background: theme.greenLight,
                  borderRadius: '12px',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: '700', color: theme.grayDark }}>
                        {lead.firstName} {lead.lastName}
                      </div>
                      <div style={{ fontSize: '13px', color: theme.gray }}>{lead.email}</div>
                      <div style={{ fontSize: '13px', color: theme.gray }}>{lead.phone}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        background: theme.green, 
                        color: 'white', 
                        padding: '4px 12px', 
                        borderRadius: '12px',
                        fontSize: '13px',
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
                </div>
              ))
            )}
          </div>
        </div>

        {/* Key Metrics Summary */}
        <div style={{ 
          marginTop: '24px',
          background: 'white', 
          borderRadius: '16px', 
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: theme.grayDark, marginBottom: '16px' }}>
            📋 Key Takeaways
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', background: theme.grayLight, borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: theme.gray, marginBottom: '4px' }}>Funnel Completion Rate</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: theme.grayDark }}>
                {(analytics.funnel.viewedResults / analytics.funnel.started * 100 || 0).toFixed(0)}%
              </div>
              <div style={{ fontSize: '12px', color: theme.gray }}>Started → Saw Results</div>
            </div>
            
            <div style={{ padding: '16px', background: theme.grayLight, borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: theme.gray, marginBottom: '4px' }}>CTA Click Rate</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: theme.grayDark }}>
                {(analytics.funnel.clickedReview / analytics.funnel.viewedResults * 100 || 0).toFixed(0)}%
              </div>
              <div style={{ fontSize: '12px', color: theme.gray }}>Saw Results → Clicked CTA</div>
            </div>
            
            <div style={{ padding: '16px', background: theme.grayLight, borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: theme.gray, marginBottom: '4px' }}>Form Completion Rate</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: theme.grayDark }}>
                {(analytics.funnel.submitted / analytics.funnel.clickedReview * 100 || 0).toFixed(0)}%
              </div>
              <div style={{ fontSize: '12px', color: theme.gray }}>Clicked CTA → Submitted</div>
            </div>
            
            <div style={{ padding: '16px', background: theme.greenLight, borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: theme.greenDark, marginBottom: '4px' }}>Overall Conversion</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: theme.green }}>
                {conversionRate}%
              </div>
              <div style={{ fontSize: '12px', color: theme.greenDark }}>Started → Lead</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '24px', color: theme.gray, fontSize: '12px' }}>
          <p>Dashboard auto-refreshes every 60 seconds from your Google Sheet</p>
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
