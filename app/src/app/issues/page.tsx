'use client'
import { useState } from 'react'

const ISSUES = [
  { id:'ISS-001', title:'order_total > 0 failing on orders.transactions', dataset:'orders.transactions', rule:'order_total > 0', severity:'critical', status:'open', owner:'Data platform', opened:'2h ago', count:412 },
  { id:'ISS-002', title:'Email regex mismatch in crm.users', dataset:'crm.users', rule:'email matches regex', severity:'critical', status:'open', owner:'Growth', opened:'3h ago', count:287 },
  { id:'ISS-003', title:'ga.sessions_daily freshness SLA breached', dataset:'ga.sessions_daily', rule:'freshness < 6h', severity:'warning', status:'investigating', owner:'Marketing', opened:'7h ago', count:1 },
  { id:'ISS-004', title:'SKU null values in inventory.items', dataset:'inventory.items', rule:'sku not null', severity:'warning', status:'open', owner:'Supply chain', opened:'5h ago', count:94 },
  { id:'ISS-005', title:'Row count drop >20% in finance.ledger', dataset:'finance.ledger', rule:'row count Δ < 20%', severity:'warning', status:'open', owner:'Finance', opened:'1h ago', count:1 },
  { id:'ISS-006', title:'Null customer IDs detected in prod.orders_fact', dataset:'prod.orders_fact', rule:'customer_id not null', severity:'critical', status:'open', owner:'Data platform', opened:'4h ago', count:1843 },
  { id:'ISS-007', title:'Duplicate order_ids in prod.orders_fact', dataset:'prod.orders_fact', rule:'order_id unique', severity:'critical', status:'resolved', owner:'Data platform', opened:'1d ago', count:0 },
  { id:'ISS-008', title:'Revenue values outside expected range', dataset:'fin.revenue', rule:'revenue range check', severity:'warning', status:'resolved', owner:'Finance', opened:'2d ago', count:0 },
]

const sevConfig = {
  critical: { bg:'#fee2e2', color:'#dc2626', dot:'#dc2626' },
  warning:  { bg:'#fef3c7', color:'#ea8b3a', dot:'#ea8b3a' },
  low:      { bg:'#f0fdf4', color:'#16a34a', dot:'#16a34a' },
}
const statusConfig = {
  open:          { bg:'#fee2e2', color:'#dc2626', label:'Open' },
  investigating: { bg:'#fef3c7', color:'#ea8b3a', label:'Investigating' },
  resolved:      { bg:'#dcfce7', color:'#16a34a', label:'Resolved' },
}

export default function IssuesPage() {
  const [filter, setFilter] = useState<'all'|'open'|'investigating'|'resolved'>('all')
  const [sev, setSev] = useState<'all'|'critical'|'warning'>('all')

  const filtered = ISSUES
    .filter(i => filter === 'all' || i.status === filter)
    .filter(i => sev   === 'all' || i.severity === sev)

  const open  = ISSUES.filter(i=>i.status==='open').length
  const inv   = ISSUES.filter(i=>i.status==='investigating').length
  const res   = ISSUES.filter(i=>i.status==='resolved').length
  const crit  = ISSUES.filter(i=>i.severity==='critical'&&i.status!=='resolved').length

  return (
    <div style={{ padding:'28px 36px', maxWidth:'1200px' }}>
      <div style={{ fontSize:'12.5px', color:'#94a3b8', marginBottom:'8px' }}>Workspace · <span style={{ color:'#475569' }}>Analytics platform</span></div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'24px', fontWeight:700, color:'#1a1a1a', margin:0 }}>Issues</h1>
          <p style={{ fontSize:'13px', color:'#64748b', margin:'4px 0 0' }}>{open+inv} open · <span style={{ color:'#dc2626', fontWeight:600 }}>{crit} critical</span></p>
        </div>
        <button style={{ background:'#dbeafe', border:'1px solid #93c5fd', padding:'8px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:600, color:'#2563eb', cursor:'pointer' }}>+ Create Issue</button>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px' }}>
        {[
          { label:'Open',          value:open, color:'#dc2626', bg:'#fee2e2' },
          { label:'Investigating', value:inv,  color:'#ea8b3a', bg:'#fef3c7' },
          { label:'Resolved',      value:res,  color:'#16a34a', bg:'#dcfce7' },
          { label:'Critical',      value:crit, color:'#dc2626', bg:'#fff1f2' },
        ].map(s=>(
          <div key={s.label} style={{ background:s.bg, border:'1px solid #ebe8df', borderRadius:'10px', padding:'14px 16px', cursor:'pointer' }} onClick={()=>setFilter(s.label.toLowerCase() as 'all'|'open'|'investigating'|'resolved')}>
            <div style={{ fontSize:'11.5px', color:'#64748b', marginBottom:'6px' }}>{s.label}</div>
            <div style={{ fontSize:'28px', fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
        {(['all','open','investigating','resolved'] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', borderRadius:'20px', border:'1px solid', fontSize:'12.5px', cursor:'pointer', fontWeight: filter===f?600:400, borderColor: filter===f?'#1a1a1a':'#e2e8f0', background: filter===f?'#1a1a1a':'#fff', color: filter===f?'#fff':'#475569' }}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
        <div style={{ width:'1px', background:'#e2e8f0', margin:'0 4px' }} />
        {(['all','critical','warning'] as const).map(s=>(
          <button key={s} onClick={()=>setSev(s)} style={{ padding:'6px 14px', borderRadius:'20px', border:'1px solid', fontSize:'12.5px', cursor:'pointer', fontWeight: sev===s?600:400, borderColor: sev===s?(s==='critical'?'#dc2626':'#ea8b3a'):'#e2e8f0', background: sev===s?(s==='critical'?'#fee2e2':'#fef3c7'):'#fff', color: sev===s?(s==='critical'?'#dc2626':'#ea8b3a'):'#475569' }}>
            {s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      {/* Issues list */}
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {filtered.map(issue=>{
          const sc = sevConfig[issue.severity as keyof typeof sevConfig] || sevConfig.low
          const st = statusConfig[issue.status as keyof typeof statusConfig]
          return (
            <div key={issue.id} style={{ background:'#fff', border:'1px solid #ebe8df', borderRadius:'12px', padding:'16px 20px', display:'flex', alignItems:'center', gap:'16px', cursor:'pointer', transition:'box-shadow 0.15s' }}
              onMouseEnter={e=>(e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,0.08)')}
              onMouseLeave={e=>(e.currentTarget.style.boxShadow='none')}>
              <div style={{ width:'4px', alignSelf:'stretch', background:sc.dot, borderRadius:'2px', flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                  <span style={{ fontSize:'11.5px', color:'#94a3b8', fontFamily:'monospace' }}>{issue.id}</span>
                  <span style={{ background:sc.bg, color:sc.color, padding:'1px 8px', borderRadius:'20px', fontSize:'11px', fontWeight:600 }}>{issue.severity}</span>
                </div>
                <div style={{ fontSize:'13.5px', fontWeight:600, color:'#1a1a1a', marginBottom:'4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{issue.title}</div>
                <div style={{ fontSize:'12px', color:'#94a3b8' }}>
                  <code style={{ background:'#f1f5f9', padding:'1px 6px', borderRadius:'4px', fontSize:'11px' }}>{issue.dataset}</code>
                  {' · '}{issue.rule}{' · '}<span>{issue.count > 0 ? `${issue.count.toLocaleString('en-US')} records affected` : 'resolved'}</span>
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ background:st.bg, color:st.color, padding:'3px 10px', borderRadius:'20px', fontSize:'11.5px', fontWeight:600, marginBottom:'6px' }}>{st.label}</div>
                <div style={{ fontSize:'11.5px', color:'#94a3b8' }}>{issue.owner} · {issue.opened}</div>
              </div>
            </div>
          )
        })}
        {filtered.length===0&&<div style={{ padding:'60px', textAlign:'center', color:'#94a3b8', background:'#fff', borderRadius:'12px', border:'1px solid #ebe8df' }}>No issues match your filters 🎉</div>}
      </div>
    </div>
  )
}
