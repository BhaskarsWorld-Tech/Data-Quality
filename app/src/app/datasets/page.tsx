'use client'
import { useState } from 'react'

const ALL_DATASETS = [
  { name: 'prod.orders_fact', source: 'Snowflake', score: 71, freshness: '14m ago', issues: 5, issueSev: 'critical', owner: 'Data platform', rows: '4.2M', domain: 'Finance', late: false },
  { name: 'crm.users_dim', source: 'Postgres', score: 82, freshness: '1h ago', issues: 3, issueSev: 'warning', owner: 'Growth', rows: '125K', domain: 'Marketing', late: false },
  { name: 'ga.sessions_daily', source: 'BigQuery', score: 85, freshness: '7h late', issues: 2, issueSev: 'warning', owner: 'Marketing', rows: '890K', domain: 'Marketing', late: true },
  { name: 'inv.items_stock', source: 'Databricks', score: 89, freshness: '22m ago', issues: 1, issueSev: 'warning', owner: 'Supply chain', rows: '52K', domain: 'Operations', late: false },
  { name: 'fin.ledger_gl', source: 'Oracle', score: 96, freshness: '3m ago', issues: 0, issueSev: 'none', owner: 'Finance', rows: '2.1M', domain: 'Finance', late: false },
  { name: 'sales.pipeline', source: 'Snowflake', score: 93, freshness: '10m ago', issues: 0, issueSev: 'none', owner: 'Sales', rows: '18K', domain: 'Sales', late: false },
  { name: 'mkt.campaigns', source: 'BigQuery', score: 88, freshness: '2h ago', issues: 2, issueSev: 'warning', owner: 'Marketing', rows: '320K', domain: 'Marketing', late: false },
  { name: 'hr.employees', source: 'Postgres', score: 99, freshness: '1d ago', issues: 0, issueSev: 'none', owner: 'HR', rows: '4.8K', domain: 'HR', late: false },
  { name: 'ops.incidents', source: 'MongoDB', score: 78, freshness: '5m ago', issues: 4, issueSev: 'critical', owner: 'Engineering', rows: '78K', domain: 'Operations', late: false },
  { name: 'fin.revenue', source: 'Snowflake', score: 97, freshness: '30m ago', issues: 0, issueSev: 'none', owner: 'Finance', rows: '980K', domain: 'Finance', late: false },
  { name: 'prod.returns', source: 'Postgres', score: 74, freshness: '3h ago', issues: 3, issueSev: 'critical', owner: 'Operations', rows: '340K', domain: 'Operations', late: false },
  { name: 'mkt.email_events', source: 'BigQuery', score: 92, freshness: '45m ago', issues: 1, issueSev: 'warning', owner: 'Marketing', rows: '5.6M', domain: 'Marketing', late: false },
]

const SOURCES = ['All sources','Snowflake','Postgres','BigQuery','Databricks','Oracle','MongoDB']
const DOMAINS = ['All domains','Finance','Marketing','Sales','Operations','HR','Engineering']

function ScorePill({ score }: { score: number }) {
  const color = score >= 90 ? '#16a34a' : score >= 80 ? '#ea8b3a' : '#dc2626'
  const bg   = score >= 90 ? '#dcfce7' : score >= 80 ? '#fef3c7' : '#fee2e2'
  return <span style={{ background: bg, color, padding: '3px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 }}>{score}</span>
}

export default function DatasetsPage() {
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('All sources')
  const [domain, setDomain] = useState('All domains')
  const [sort, setSort] = useState<'score'|'name'|'issues'>('score')

  const filtered = ALL_DATASETS
    .filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
    .filter(d => source === 'All sources' || d.source === source)
    .filter(d => domain === 'All domains' || d.domain === domain)
    .sort((a,b) => sort === 'score' ? a.score - b.score : sort === 'issues' ? b.issues - a.issues : a.name.localeCompare(b.name))

  const sel: React.CSSProperties = { padding:'8px 12px', borderRadius:'8px', border:'1px solid #e2e8f0', fontSize:'13px', background:'#fff', color:'#475569', cursor:'pointer', outline:'none' }

  return (
    <div style={{ padding:'28px 36px', maxWidth:'1300px' }}>
      <div style={{ fontSize:'12.5px', color:'#94a3b8', marginBottom:'8px' }}>Workspace · <span style={{ color:'#475569' }}>Analytics platform</span></div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'24px', fontWeight:700, color:'#1a1a1a', margin:0 }}>Datasets</h1>
          <p style={{ fontSize:'13px', color:'#64748b', margin:'4px 0 0' }}>{filtered.length} of {ALL_DATASETS.length} datasets · {ALL_DATASETS.filter(d=>d.issues>0).length} with open issues</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {(['score','name','issues'] as const).map(s => (
            <button key={s} onClick={()=>setSort(s)} style={{ padding:'6px 12px', borderRadius:'6px', border:'1px solid', fontSize:'12px', cursor:'pointer', fontWeight: sort===s?600:400, borderColor: sort===s?'#2563eb':'#e2e8f0', background: sort===s?'#eff6ff':'#fff', color: sort===s?'#2563eb':'#475569' }}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', gap:'10px', marginBottom:'20px' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search datasets..." style={{ ...sel, width:'220px' }} />
        <select value={source} onChange={e=>setSource(e.target.value)} style={sel}>{SOURCES.map(s=><option key={s}>{s}</option>)}</select>
        <select value={domain} onChange={e=>setDomain(e.target.value)} style={sel}>{DOMAINS.map(d=><option key={d}>{d}</option>)}</select>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px' }}>
        {[
          { label:'Total Datasets', value:ALL_DATASETS.length, color:'#1a1a1a', bg:'#fff' },
          { label:'Healthy (≥90)',  value:ALL_DATASETS.filter(d=>d.score>=90).length, color:'#16a34a', bg:'#dcfce7' },
          { label:'At Risk (80–89)',value:ALL_DATASETS.filter(d=>d.score>=80&&d.score<90).length, color:'#ea8b3a', bg:'#fef3c7' },
          { label:'Critical (<80)', value:ALL_DATASETS.filter(d=>d.score<80).length, color:'#dc2626', bg:'#fee2e2' },
        ].map(s=>(
          <div key={s.label} style={{ background:s.bg, border:'1px solid #ebe8df', borderRadius:'10px', padding:'14px 16px' }}>
            <div style={{ fontSize:'11.5px', color:'#64748b', marginBottom:'6px' }}>{s.label}</div>
            <div style={{ fontSize:'28px', fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #ebe8df', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
          <thead>
            <tr style={{ background:'#fafaf9', borderBottom:'1px solid #ebe8df' }}>
              {['Dataset','Source','Domain','Score','Rows','Freshness','Issues','Owner'].map(h=>(
                <th key={h} style={{ textAlign:'left', padding:'10px 14px', color:'#64748b', fontWeight:600, fontSize:'11.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((ds,i)=>(
              <tr key={i} style={{ borderBottom:'1px solid #f3f1ea', cursor:'pointer', transition:'background 0.1s' }}
                onMouseEnter={e=>(e.currentTarget.style.background='#fafaf9')}
                onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                <td style={{ padding:'12px 14px' }}><span style={{ color:'#94a3b8' }}>{ds.name.split('.')[0]}.</span><span style={{ fontWeight:600, color:'#1a1a1a' }}>{ds.name.split('.')[1]}</span></td>
                <td style={{ padding:'12px 14px' }}><span style={{ background:'#f1f5f9', padding:'2px 8px', borderRadius:'5px', fontSize:'11.5px', color:'#475569', fontWeight:500 }}>{ds.source}</span></td>
                <td style={{ padding:'12px 14px', color:'#475569' }}>{ds.domain}</td>
                <td style={{ padding:'12px 14px' }}><ScorePill score={ds.score} /></td>
                <td style={{ padding:'12px 14px', color:'#475569' }}>{ds.rows}</td>
                <td style={{ padding:'12px 14px', color:ds.late?'#ea8b3a':'#475569', fontWeight:ds.late?600:400 }}>{ds.freshness}</td>
                <td style={{ padding:'12px 14px' }}>{ds.issues>0?<span style={{ color:ds.issueSev==='critical'?'#dc2626':'#ea8b3a', fontWeight:600 }}>● {ds.issues} {ds.issueSev}</span>:<span style={{ color:'#94a3b8' }}>—</span>}</td>
                <td style={{ padding:'12px 14px', color:'#475569' }}>{ds.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{ padding:'60px', textAlign:'center', color:'#94a3b8' }}>No datasets match your filters</div>}
      </div>
    </div>
  )
}
