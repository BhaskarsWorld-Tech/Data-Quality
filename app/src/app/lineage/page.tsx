'use client'
import { useState } from 'react'

const NODES = [
  { id:'src1', label:'Postgres\nprod_db', type:'source', x:60, y:80, icon:'🐘' },
  { id:'src2', label:'Snowflake\nanalytics', type:'source', x:60, y:220, icon:'❄️' },
  { id:'src3', label:'BigQuery\nmarketing', type:'source', x:60, y:360, icon:'📊' },
  { id:'t1', label:'orders_fact\ntransform', type:'transform', x:260, y:80, icon:'⚙️' },
  { id:'t2', label:'users_dim\ntransform', type:'transform', x:260, y:220, icon:'⚙️' },
  { id:'t3', label:'sessions\naggregate', type:'transform', x:260, y:360, icon:'⚙️' },
  { id:'dw1', label:'prod.orders\n_fact', type:'warehouse', x:460, y:140, icon:'🗄️' },
  { id:'dw2', label:'crm.users\n_dim', type:'warehouse', x:460, y:280, icon:'🗄️' },
  { id:'out1', label:'Revenue\nDashboard', type:'output', x:660, y:100, icon:'📈' },
  { id:'out2', label:'ML Pipeline\n(Churn)', type:'output', x:660, y:220, icon:'🤖' },
  { id:'out3', label:'Marketing\nReports', type:'output', x:660, y:340, icon:'📋' },
]

const EDGES = [
  { from:'src1', to:'t1' }, { from:'src1', to:'t2' },
  { from:'src2', to:'t1' }, { from:'src3', to:'t3' },
  { from:'t1', to:'dw1' }, { from:'t2', to:'dw2' }, { from:'t3', to:'dw2' },
  { from:'dw1', to:'out1' }, { from:'dw1', to:'out2' },
  { from:'dw2', to:'out2' }, { from:'dw2', to:'out3' },
]

const typeConfig = {
  source:    { bg:'#eff6ff', border:'#93c5fd', color:'#1d4ed8', label:'Source' },
  transform: { bg:'#faf5ff', border:'#c4b5fd', color:'#7c3aed', label:'Transform' },
  warehouse: { bg:'#f0fdf4', border:'#86efac', color:'#166534', label:'Warehouse' },
  output:    { bg:'#fff7ed', border:'#fdba74', color:'#c2410c', label:'Output' },
}

function getCenter(node: typeof NODES[0]) {
  return { x: node.x + 70, y: node.y + 36 }
}

export default function LineagePage() {
  const [selected, setSelected] = useState<string|null>(null)

  const highlighted = selected
    ? new Set([selected, ...EDGES.filter(e=>e.from===selected||e.to===selected).flatMap(e=>[e.from,e.to])])
    : null

  return (
    <div style={{ padding:'28px 36px', maxWidth:'1300px' }}>
      <div style={{ fontSize:'12.5px', color:'#94a3b8', marginBottom:'8px' }}>Workspace · <span style={{ color:'#475569' }}>Analytics platform</span></div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'24px', fontWeight:700, color:'#1a1a1a', margin:0 }}>Data Lineage</h1>
          <p style={{ fontSize:'13px', color:'#64748b', margin:'4px 0 0' }}>End-to-end data flow across your pipeline · click a node to trace dependencies</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {Object.entries(typeConfig).map(([type,cfg])=>(
            <div key={type} style={{ display:'flex', alignItems:'center', gap:'6px', background:cfg.bg, border:`1px solid ${cfg.border}`, padding:'4px 12px', borderRadius:'20px' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:cfg.border }} />
              <span style={{ fontSize:'11.5px', color:cfg.color, fontWeight:500 }}>{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:'#fff', border:'1px solid #ebe8df', borderRadius:'14px', padding:'20px', overflow:'auto' }}>
        <svg width="800" height="480" viewBox="0 0 800 480" style={{ display:'block', margin:'0 auto' }}>
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
            </marker>
            <marker id="arrow-hl" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#2563eb" />
            </marker>
          </defs>

          {/* Edges */}
          {EDGES.map((edge,i)=>{
            const from = NODES.find(n=>n.id===edge.from)!
            const to   = NODES.find(n=>n.id===edge.to)!
            const fc = getCenter(from), tc = getCenter(to)
            const isHL = highlighted && (highlighted.has(edge.from) && highlighted.has(edge.to))
            const midX = (fc.x + tc.x) / 2
            return (
              <path key={i}
                d={`M${fc.x},${fc.y} C${midX},${fc.y} ${midX},${tc.y} ${tc.x-2},${tc.y}`}
                fill="none" stroke={isHL?'#2563eb':'#cbd5e1'} strokeWidth={isHL?2:1.5}
                strokeDasharray={isHL?'none':'none'} markerEnd={isHL?'url(#arrow-hl)':'url(#arrow)'}
                style={{ transition:'stroke 0.2s, stroke-width 0.2s' }} />
            )
          })}

          {/* Nodes */}
          {NODES.map(node=>{
            const cfg = typeConfig[node.type as keyof typeof typeConfig]
            const isSelected = selected===node.id
            const isDimmed = highlighted && !highlighted.has(node.id)
            const lines = node.label.split('\n')
            return (
              <g key={node.id} style={{ cursor:'pointer' }}
                onClick={()=>setSelected(selected===node.id?null:node.id)}>
                <rect x={node.x} y={node.y} width={140} height={72} rx={10}
                  fill={cfg.bg} stroke={isSelected?'#2563eb':cfg.border}
                  strokeWidth={isSelected?2.5:1.5}
                  opacity={isDimmed?0.3:1}
                  style={{ transition:'all 0.2s' }} />
                <text x={node.x+22} y={node.y+28} fontSize="18">{node.icon}</text>
                <text x={node.x+46} y={node.y+26} fontSize="11.5" fontWeight={isSelected?700:600} fill={cfg.color} opacity={isDimmed?0.3:1}>{lines[0]}</text>
                <text x={node.x+46} y={node.y+42} fontSize="10.5" fill={cfg.color} opacity={isDimmed?0.3:1} style={{ opacity: isDimmed?0.3:0.7 }}>{lines[1]}</text>
                {isSelected&&<rect x={node.x} y={node.y} width={140} height={72} rx={10} fill="none" stroke="#2563eb" strokeWidth="2.5" />}
              </g>
            )
          })}
        </svg>
      </div>

      {selected && (
        <div style={{ marginTop:'16px', background:'#fff', border:'1px solid #ebe8df', borderRadius:'12px', padding:'20px' }}>
          {(() => {
            const node = NODES.find(n=>n.id===selected)!
            const upstream   = EDGES.filter(e=>e.to===selected).map(e=>NODES.find(n=>n.id===e.from)!)
            const downstream = EDGES.filter(e=>e.from===selected).map(e=>NODES.find(n=>n.id===e.to)!)
            return (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'20px' }}>
                <div>
                  <div style={{ fontSize:'11.5px', color:'#94a3b8', fontWeight:600, marginBottom:'8px' }}>SELECTED NODE</div>
                  <div style={{ fontSize:'16px', fontWeight:700, color:'#1a1a1a' }}>{node.icon} {node.label.replace('\n',' ')}</div>
                  <div style={{ fontSize:'12px', color:'#64748b', marginTop:'4px', textTransform:'capitalize' }}>{node.type}</div>
                </div>
                <div>
                  <div style={{ fontSize:'11.5px', color:'#94a3b8', fontWeight:600, marginBottom:'8px' }}>UPSTREAM ({upstream.length})</div>
                  {upstream.length>0?upstream.map(n=><div key={n.id} style={{ fontSize:'13px', color:'#475569', marginBottom:'4px' }}>{n.icon} {n.label.replace('\n',' ')}</div>):<div style={{ fontSize:'13px', color:'#94a3b8' }}>No upstream sources</div>}
                </div>
                <div>
                  <div style={{ fontSize:'11.5px', color:'#94a3b8', fontWeight:600, marginBottom:'8px' }}>DOWNSTREAM ({downstream.length})</div>
                  {downstream.length>0?downstream.map(n=><div key={n.id} style={{ fontSize:'13px', color:'#475569', marginBottom:'4px' }}>{n.icon} {n.label.replace('\n',' ')}</div>):<div style={{ fontSize:'13px', color:'#94a3b8' }}>No downstream targets</div>}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
