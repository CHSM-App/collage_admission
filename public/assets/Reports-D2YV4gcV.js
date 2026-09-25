import{a as e,n as t,t as n}from"./jsx-runtime-C27Mmbu5.js";import{m as r,p as i}from"./index-DLZ8C76P.js";import{o as a}from"./Skeleton-CgO0mEqo.js";import{M as o}from"./masterService-CqtYJajU.js";var s=e(t(),1),c=n(),l={1:`FY — First Year`,2:`SY — Second Year`,3:`TY — Third Year`,4:`4Y — Fourth Year`,5:`5Y — Fifth Year`},u={1:`FY`,2:`SY`,3:`TY`,4:`4Y`,5:`5Y`},d=[{key:`fees`,label:`Fees Report`},{key:`ng_fees`,label:`NG Fees Report`},{key:`misc`,label:`Misc. Fees Report`},{key:`ng_misc`,label:`NG Misc. Fees Report`},{key:`exam_grant`,label:`Exam Fees (Grant)`},{key:`exam_ng`,label:`Exam Fees (Non-Grant)`}],f=[{key:``,label:`All Modes`},{key:`cash`,label:`Cash`},{key:`online`,label:`Online/GPay`}];function p(){let e=new Date,t=e.getMonth()>=5?e.getFullYear():e.getFullYear()-1;return Array.from({length:10},(e,n)=>{let r=t-3+n;return`${r}-${String(r+1).slice(-2)}`})}var m=p();(()=>{let e=new Date,t=e.getMonth()>=5?e.getFullYear():e.getFullYear()-1;return`${t}-${String(t+1).slice(-2)}`})();function h(){return new Date().toISOString().slice(0,10)}function g(e){return`₹${Number(e||0).toLocaleString(`en-IN`)}`}function _(e){if(!e)return null;try{return new Date(e.toString().replace(` `,`T`).split(`.`)[0])}catch{return null}}function v(e){let t=_(e);return t?t.toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`}):`—`}function y(e){let t=_(e);return t?t.toLocaleTimeString(`en-IN`,{hour:`2-digit`,minute:`2-digit`,hour12:!0}):``}function b(e){return e?new Date(e+`T00:00:00`).toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`}):`—`}function ee(e){let t=new Date,n=e=>e.toISOString().slice(0,10);if(e===`today`)return{from:n(t),to:n(t)};if(e===`yesterday`){let e=new Date(t);return e.setDate(e.getDate()-1),{from:n(e),to:n(e)}}if(e===`this_week`){let e=new Date(t);return e.setDate(e.getDate()-e.getDay()),{from:n(e),to:n(t)}}if(e===`this_month`)return{from:n(new Date(t.getFullYear(),t.getMonth(),1)),to:n(t)};if(e===`last_month`){let e=new Date(t.getFullYear(),t.getMonth()-1,1),r=new Date(t.getFullYear(),t.getMonth(),0);return{from:n(e),to:n(r)}}return null}var te=[{key:`today`,label:`Today`},{key:`yesterday`,label:`Yesterday`},{key:`this_week`,label:`This Week`},{key:`this_month`,label:`This Month`},{key:`last_month`,label:`Last Month`},{key:`custom`,label:`Custom`}];function x({collegeId:e}){let[t,n]=(0,s.useState)([]),[p,_]=(0,s.useState)(!1),[x,ne]=(0,s.useState)(null),[E,D]=(0,s.useState)(``),[O,k]=(0,s.useState)(`fees`),[A,re]=(0,s.useState)(``),[j,ie]=(0,s.useState)(``),[M,ae]=(0,s.useState)(``),[oe,N]=(0,s.useState)(`today`),[P,F]=(0,s.useState)(h()),[I,L]=(0,s.useState)(h()),[R,z]=(0,s.useState)(``),[B,V]=(0,s.useState)(``),[H,se]=(0,s.useState)(`college_fee`),[U,ce]=(0,s.useState)(!1),[W,G]=(0,s.useState)(``);(0,s.useEffect)(()=>{o(e).then(e=>n((e.data.data||[]).filter(e=>e.is_active))).catch(()=>{})},[e]);function le(e){if(N(e),e!==`custom`){let t=ee(e);F(t.from),L(t.to)}}let K=(0,s.useCallback)(()=>{_(!0),D(``);let t=new URLSearchParams({date_from:P,date_to:I,payment_type:H});R&&t.set(`course_id`,R),B&&t.set(`year_of_study`,B),M&&t.set(`academic_year`,M),A&&t.set(`pay_mode`,A),j&&t.set(`grant_type`,j),O!==`fees`&&t.set(`report_type`,O),r(e,t).then(e=>ne(e.data.data)).catch(()=>D(`Failed to load report.`)).finally(()=>_(!1))},[e,P,I,R,B,H,M,A,j,O]);(0,s.useEffect)(()=>{K()},[K]);let q=x?.summary,J=P===I;function Y(){let e=new URLSearchParams({date_from:P,date_to:I,payment_type:H});return R&&e.set(`course_id`,R),B&&e.set(`year_of_study`,B),M&&e.set(`academic_year`,M),A&&e.set(`pay_mode`,A),j&&e.set(`grant_type`,j),e}function X(e){return Number(e||0).toLocaleString(`en-IN`)}function Z(e){let t=[``,`One`,`Two`,`Three`,`Four`,`Five`,`Six`,`Seven`,`Eight`,`Nine`,`Ten`,`Eleven`,`Twelve`,`Thirteen`,`Fourteen`,`Fifteen`,`Sixteen`,`Seventeen`,`Eighteen`,`Nineteen`],n=[``,``,`Twenty`,`Thirty`,`Forty`,`Fifty`,`Sixty`,`Seventy`,`Eighty`,`Ninety`];function r(e){return e===0?``:e<20?t[e]:e<100?n[Math.floor(e/10)]+(e%10?` `+t[e%10]:``):e<1e3?t[Math.floor(e/100)]+` Hundred`+(e%100?` `+r(e%100):``):e<1e5?r(Math.floor(e/1e3))+` Thousand`+(e%1e3?` `+r(e%1e3):``):e<1e7?r(Math.floor(e/1e5))+` Lakh`+(e%1e5?` `+r(e%1e5):``):r(Math.floor(e/1e7))+` Crore`+(e%1e7?` `+r(e%1e7):``)}return(r(Math.round(e))||`Zero`)+` Rupees Only`}function Q(e,t,n){let r=e?.name||``,i=e?.address||``;return`
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;">
        <div style="font-size:15px;font-weight:bold;">${r}</div>
        ${i?`<div style="font-size:11px;">${i}</div>`:``}
        <div style="font-size:13px;font-weight:bold;margin-top:6px;text-decoration:underline;">${t}</div>
        <div style="font-size:11px;margin-top:2px;">Period: ${n}${M?` | Edu. Year: `+M:``}${j===`Granted`?` | Grant`:j===`NonGranted`?` | Non-Grant`:``}</div>
      </div>`}async function ue(){G(`total`);try{let{college:t,head_totals:n}=(await i(e,Y())).data.data,r=P===I?b(P):`${b(P)} to ${b(I)}`,a=n.reduce((e,t)=>e+(t.total_collected||0),0),o=new Date().toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`}),s=n.map((e,t)=>`
        <tr>
          <td style="border:1px solid #999;padding:4px 8px;text-align:center;">${t+1}</td>
          <td style="border:1px solid #999;padding:4px 8px;">${e.fees_head}${e.academic_year?` - `+e.academic_year:``}</td>
          <td style="border:1px solid #999;padding:4px 8px;text-align:right;font-family:monospace;">${X(e.total_collected)}</td>
        </tr>`).join(``);$(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Total Fees Collection</title>
        <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
        @media print{body{padding:0}@page{size:A4 portrait;margin:12mm}}</style>
      </head><body>
        ${Q(t,`TOTAL FEES COLLECTION REPORT`,r)}
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="border:1px solid #999;padding:5px 8px;width:50px;">Sr.No.</th>
              <th style="border:1px solid #999;padding:5px 8px;text-align:left;">Particular</th>
              <th style="border:1px solid #999;padding:5px 8px;text-align:right;width:140px;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>${s}</tbody>
          <tfoot>
            <tr style="font-weight:bold;background:#f8f8f8;">
              <td colspan="2" style="border:1px solid #999;padding:5px 8px;text-align:right;">Grand Total</td>
              <td style="border:1px solid #999;padding:5px 8px;text-align:right;font-family:monospace;">${X(a)}</td>
            </tr>
            <tr>
              <td colspan="3" style="border:1px solid #999;padding:5px 8px;font-style:italic;">
                Rupees: ${Z(a)}
              </td>
            </tr>
          </tfoot>
        </table>
        <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:11px;">
          <span>Printed on: ${o}</span>
          <span>Cashier's Signature</span>
          <span>Principal's Signature</span>
        </div>
      </body></html>`)}catch{alert(`Failed to generate report.`)}finally{G(``)}}async function de(){G(`bank`);try{let{college:t,bank_groups:n}=(await i(e,Y())).data.data,r=P===I?b(P):`${b(P)} to ${b(I)}`,a=n.reduce((e,t)=>e+(t.total||0),0),o=new Date().toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`}),s=0,c=n.map(e=>`
          <tr style="background:#e8e8e8;">
            <td colspan="3" style="border:1px solid #999;padding:5px 8px;font-weight:bold;">${e.bank_name+(e.bank_account_number?` (A/c: ${e.bank_account_number})`:``)+(e.branch?` — ${e.branch}`:``)}</td>
          </tr>
          ${e.heads.map(e=>(s++,`<tr>
            <td style="border:1px solid #999;padding:4px 8px;text-align:center;">${s}</td>
            <td style="border:1px solid #999;padding:4px 8px;">${e.fees_head}${e.academic_year?` - `+e.academic_year:``}</td>
            <td style="border:1px solid #999;padding:4px 8px;text-align:right;font-family:monospace;">${X(e.total_collected)}</td>
          </tr>`)).join(``)}
          <tr style="font-weight:bold;background:#f5f5f5;">
            <td colspan="2" style="border:1px solid #999;padding:4px 8px;text-align:right;">Bank Total</td>
            <td style="border:1px solid #999;padding:4px 8px;text-align:right;font-family:monospace;">${X(e.total)}</td>
          </tr>`).join(``);$(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Bankwise Statement</title>
        <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
        @media print{body{padding:0}@page{size:A4 portrait;margin:12mm}}</style>
      </head><body>
        ${Q(t,`TOTAL FEES BANKWISE STATEMENT`,r)}
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="border:1px solid #999;padding:5px 8px;width:50px;">Sr.No.</th>
              <th style="border:1px solid #999;padding:5px 8px;text-align:left;">Particular</th>
              <th style="border:1px solid #999;padding:5px 8px;text-align:right;width:140px;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>${c}</tbody>
          <tfoot>
            <tr style="font-weight:bold;background:#f0f0f0;">
              <td colspan="2" style="border:1px solid #999;padding:5px 8px;text-align:right;">Grand Total</td>
              <td style="border:1px solid #999;padding:5px 8px;text-align:right;font-family:monospace;">${X(a)}</td>
            </tr>
            <tr>
              <td colspan="3" style="border:1px solid #999;padding:5px 8px;font-style:italic;">
                Rupees: ${Z(a)}
              </td>
            </tr>
          </tfoot>
        </table>
        <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:11px;">
          <span>Printed on: ${o}</span>
          <span>Cashier's Signature</span>
          <span>Principal's Signature</span>
        </div>
      </body></html>`)}catch{alert(`Failed to generate report.`)}finally{G(``)}}async function fe(){G(`daily`);try{let{college:t,student_rows:n,head_totals:r}=(await i(e,Y())).data.data,a=P===I?b(P):`${b(P)} to ${b(I)}`,o=new Date().toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`}),s=r;s.map(e=>e.fees_code);let c={};for(let e of s)c[e.fees_code]=e.total_collected||0;let l=s.reduce((e,t)=>e+(t.total_collected||0),0),u={1:`FY`,2:`SY`,3:`TY`,4:`4Y`,5:`5Y`},d=s.map(e=>`<th style="border:1px solid #999;padding:3px 4px;text-align:center;font-size:9px;min-width:52px;">${e.short_name||e.fees_head}</th>`).join(``),f=new Map;for(let e of n){let t=e.completed_at?e.completed_at.toString().slice(0,10):`Unknown`;f.has(t)||f.set(t,[]),f.get(t).push(e)}let p=0,m=``,h={};for(let[e,t]of f){m+=`<tr style="background:#e8f0e8;">
          <td colspan="${3+s.length+1}" style="border:1px solid #999;padding:3px 8px;font-weight:bold;font-size:10px;">
            Date: ${b(e)}
          </td>
        </tr>`,h[e]||(h[e]={});for(let n of t){p++,n.gateway===`cash`||(n.gateway_txnid||``).startsWith(`CASH-`);let t=`${u[n.year_of_study]||``}${n.degree_course_code||``}${n.app_division?` `+n.app_division:``}`,r=s.map(t=>{let r=n.head_amounts?.[t.fees_code]||0;return h[e][t.fees_code]=(h[e][t.fees_code]||0)+r,`<td style="border:1px solid #999;padding:3px 4px;text-align:right;font-family:monospace;font-size:10px;">${r>0?X(r):``}</td>`}).join(``),i=Object.values(n.head_amounts||{}).reduce((e,t)=>e+t,0);m+=`<tr>
            <td style="border:1px solid #999;padding:3px 4px;text-align:center;font-size:10px;">${p}</td>
            <td style="border:1px solid #999;padding:3px 6px;font-size:10px;">${n.student_name||`—`}</td>
            <td style="border:1px solid #999;padding:3px 4px;font-size:10px;text-align:center;">${t}</td>
            ${r}
            <td style="border:1px solid #999;padding:3px 4px;text-align:right;font-family:monospace;font-size:10px;font-weight:bold;">${X(i)}</td>
          </tr>`}let n=s.map(t=>`<td style="border:1px solid #999;padding:3px 4px;text-align:right;font-family:monospace;font-size:10px;background:#f5f8f5;">${X(h[e][t.fees_code]||0)}</td>`).join(``),r=Object.values(h[e]).reduce((e,t)=>e+t,0);m+=`<tr style="font-weight:bold;background:#f5f8f5;">
          <td colspan="3" style="border:1px solid #999;padding:3px 8px;text-align:right;font-size:10px;">Daily Total</td>
          ${n}
          <td style="border:1px solid #999;padding:3px 4px;text-align:right;font-family:monospace;font-size:10px;">${X(r)}</td>
        </tr>`}let g=s.map(e=>`<td style="border:2px solid #666;padding:4px;text-align:right;font-family:monospace;font-size:10px;background:#f0f0e8;">${X(c[e.fees_code]||0)}</td>`).join(``);m+=`<tr style="font-weight:bold;background:#f0f0e8;">
        <td colspan="3" style="border:2px solid #666;padding:4px 8px;text-align:right;font-size:11px;">Grand Total</td>
        ${g}
        <td style="border:2px solid #666;padding:4px;text-align:right;font-family:monospace;font-size:11px;">${X(l)}</td>
      </tr>`,$(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Daily Fees Register</title>
        <style>*{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;font-size:10px;padding:12px}
        @media print{body{padding:0}@page{size:A4 landscape;margin:8mm}}</style>
      </head><body>
        ${Q(t,`FEES COLLECTION DAILY REGISTER`,a)}
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="border:1px solid #999;padding:4px;width:36px;text-align:center;font-size:10px;">Sr.</th>
              <th style="border:1px solid #999;padding:4px;text-align:left;font-size:10px;min-width:140px;">Student Name</th>
              <th style="border:1px solid #999;padding:4px;text-align:center;font-size:10px;width:60px;">Class</th>
              ${d}
              <th style="border:1px solid #999;padding:4px;text-align:right;font-size:10px;min-width:60px;">Total</th>
            </tr>
          </thead>
          <tbody>${m}</tbody>
        </table>
        </div>
        <div style="margin-top:8px;font-size:9px;color:#555;">
          <strong>Legend:</strong> ${s.map(e=>`${e.short_name} = ${e.fees_head}`).join(` | `)}
        </div>
        <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:11px;">
          <span>Printed on: ${o}</span>
          <span>Cashier's Signature</span>
          <span>Principal's Signature</span>
        </div>
      </body></html>`)}catch{alert(`Failed to generate report.`)}finally{G(``)}}function $(e){let t=window.open(``,`_blank`,`width=1200,height=900`);t.document.write(e),t.document.close(),t.focus(),setTimeout(()=>{t.print()},600)}function pe(){if(!x)return;let e=x.college_name||``,n=x.college_address||``,r=R?t.find(e=>String(e.code_no)===String(R))?.degree_course_name||``:`All Classes`,i=B?u[B]||B:`All Years`,a=H===`college_fee`?`College Fee`:H===`application_fee`?`Application Fee`:`All Types`,o=A===`cash`?`Cash`:A===`online`?`Online`:`All Modes`,s=j===`Granted`?`Grant`:j===`NonGranted`?`Non-Grant`:`All`,c=J?b(P):`${b(P)} to ${b(I)}`,l=new Date().toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`}),d=(e,t)=>`<th style="border:1px solid #999;padding:5px 8px;background:#f0f0f0;font-size:11px;${t?`text-align:right;`:`text-align:left;`}">${e}</th>`,f=(e,t,n,r)=>`<td style="border:1px solid #ccc;padding:4px 8px;font-size:11px;${t?`text-align:right;`:``}${n?`font-weight:bold;`:``}${r?`font-family:monospace;`:``}">${e}</td>`,p=e=>`<div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #000;padding-bottom:3px;margin:18px 0 8px;">${e}</div>`,m=`
      <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
        <tr>
          ${[`Total Collected`,`Transactions`,`Students`,`Cash`,`Online`].map(e=>d(e,!0)).join(``)}
        </tr>
        <tr>
          ${[`&#8377;${Number(q.total_collected).toLocaleString(`en-IN`)}`,q.txn_count,q.student_count,`&#8377;${Number(q.cash_amount).toLocaleString(`en-IN`)}`,`&#8377;${Number(q.online_amount).toLocaleString(`en-IN`)}`].map(e=>f(e,!0,!0,!1)).join(``)}
        </tr>
      </table>`,h=!J&&x.by_day.length>0?`
      ${p(`Day-wise Breakdown`)}
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          ${d(`Date`)}${d(`Transactions`,!0)}${d(`Cash (&#8377;)`,!0)}${d(`Online (&#8377;)`,!0)}${d(`Total (&#8377;)`,!0)}
        </tr></thead>
        <tbody>
          ${x.by_day.map(e=>`<tr>
            ${f(b(e.date))}
            ${f(e.txn_count,!0)}
            ${f(Number(e.cash).toLocaleString(`en-IN`),!0,!1,!0)}
            ${f(Number(e.online).toLocaleString(`en-IN`),!0,!1,!0)}
            ${f(Number(e.total).toLocaleString(`en-IN`),!0,!0,!0)}
          </tr>`).join(``)}
        </tbody>
        <tfoot><tr style="background:#f5f5f5;">
          ${f(`Total`,!1,!0)}
          ${f(q.txn_count,!0,!0)}
          ${f(Number(q.cash_amount).toLocaleString(`en-IN`),!0,!0,!0)}
          ${f(Number(q.online_amount).toLocaleString(`en-IN`),!0,!0,!0)}
          ${f(Number(q.total_collected).toLocaleString(`en-IN`),!0,!0,!0)}
        </tr></tfoot>
      </table>`:``,g=x.by_course.length>0?`
      ${p(`Course-wise Breakdown`)}
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          ${d(`Course`)}${d(`Year`)}${d(`Transactions`,!0)}${d(`Total (&#8377;)`,!0)}
        </tr></thead>
        <tbody>
          ${x.by_course.map(e=>`<tr>
            ${f(e.course_name)}
            ${f(u[e.year_of_study]||e.year_of_study)}
            ${f(e.txn_count,!0)}
            ${f(Number(e.total).toLocaleString(`en-IN`),!0,!0,!0)}
          </tr>`).join(``)}
        </tbody>
      </table>`:``,_=x.transactions.length>0?`
      ${p(`Transactions (${x.transactions.length}${x.transactions.length===200?`+`:``})`)}
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          ${d(`#`)}${d(`Student`)}${d(`Course / Year`)}${d(`Reg. No.`)}${d(`Mode`)}${d(`Date & Time`)}${d(`Amount (&#8377;)`,!0)}
        </tr></thead>
        <tbody>
          ${x.transactions.map((e,t)=>{let n=e.gateway===`cash`||(e.gateway_txnid||``).startsWith(`CASH-`);return`<tr style="${t%2==0?``:`background:#f9f9f9;`}">
              ${f(t+1)}
              ${f(e.student_name||`—`)}
              ${f(`${e.course_name} · ${u[e.year_of_study]||``}${e.app_division?` Div `+e.app_division:``}`)}
              ${f(e.registration_number||`—`)}
              ${f(n?`Cash`:`Online`)}
              ${f(v(e.completed_at)+` `+y(e.completed_at))}
              ${f(Number(e.amount).toLocaleString(`en-IN`),!0,!0,!0)}
            </tr>`}).join(``)}
        </tbody>
      </table>`:``;$(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Fees Collection Report</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
      @media print{body{padding:0}@page{size:A4 landscape;margin:10mm 12mm}}</style>
    </head><body>
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;">
        ${e?`<div style="font-size:15px;font-weight:bold;">${e}</div>`:``}
        ${n?`<div style="font-size:11px;">${n}</div>`:``}
        <div style="font-size:13px;font-weight:bold;margin-top:6px;text-decoration:underline;">FEES COLLECTION SUMMARY</div>
        <div style="font-size:11px;margin-top:2px;">Period: ${c}${M?` | Edu. Year: `+M:``}</div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;margin-bottom:10px;">
        <span>Class: <strong>${r}</strong></span>
        <span>Year: <strong>${i}</strong></span>
        <span>Type: <strong>${a}</strong></span>
        <span>Mode: <strong>${o}</strong></span>
        <span>Grant: <strong>${s}</strong></span>
        <span style="margin-left:auto;color:#555;">Printed: ${l}</span>
      </div>
      ${m}
      ${h}
      ${g}
      ${_}
      <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:11px;">
        <span></span>
        <span>Cashier's Signature</span>
        <span>Principal's Signature</span>
      </div>
    </body></html>`)}return(0,c.jsxs)(`section`,{className:`space-y-5 max-w-5xl`,children:[(0,c.jsxs)(`div`,{className:`flex items-start justify-between gap-4`,children:[(0,c.jsxs)(`div`,{children:[(0,c.jsx)(`p`,{className:`text-sm font-semibold uppercase tracking-wide text-emerald-600`,children:`College Reports`}),(0,c.jsx)(`h1`,{className:`mt-1 text-2xl font-bold text-slate-950`,children:`Fees Collection`})]}),x&&!p&&(0,c.jsxs)(`div`,{className:`flex flex-wrap gap-2 shrink-0`,children:[(0,c.jsxs)(`button`,{onClick:ue,disabled:!!W,className:`flex items-center gap-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold px-3 py-2 hover:bg-emerald-600 transition disabled:opacity-50`,children:[W===`total`?`…`:`⬇`,` Total Fees`]}),(0,c.jsxs)(`button`,{onClick:de,disabled:!!W,className:`flex items-center gap-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold px-3 py-2 hover:bg-blue-600 transition disabled:opacity-50`,children:[W===`bank`?`…`:`⬇`,` Bankwise`]}),(0,c.jsxs)(`button`,{onClick:fe,disabled:!!W,className:`flex items-center gap-1.5 rounded-lg bg-violet-700 text-white text-xs font-semibold px-3 py-2 hover:bg-violet-600 transition disabled:opacity-50`,children:[W===`daily`?`…`:`⬇`,` Daily Register`]}),(0,c.jsxs)(`button`,{onClick:pe,className:`flex items-center gap-2 rounded-lg bg-slate-900 text-white text-sm font-semibold px-4 py-2 hover:bg-slate-700 transition`,children:[(0,c.jsx)(`svg`,{className:`w-4 h-4`,fill:`none`,viewBox:`0 0 24 24`,stroke:`currentColor`,strokeWidth:`2`,children:(0,c.jsx)(`path`,{strokeLinecap:`round`,strokeLinejoin:`round`,d:`M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z`})}),`Print Summary`]})]})]}),(0,c.jsxs)(`div`,{className:`rounded-xl border border-slate-200 bg-white px-4 py-4 space-y-4`,children:[(0,c.jsxs)(`div`,{children:[(0,c.jsx)(`p`,{className:`text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2`,children:`Report Type`}),(0,c.jsx)(`div`,{className:`flex flex-wrap gap-3`,children:d.map(e=>(0,c.jsxs)(`label`,{className:`flex items-center gap-1.5 text-sm cursor-pointer`,children:[(0,c.jsx)(`input`,{type:`radio`,name:`reportType`,value:e.key,checked:O===e.key,onChange:()=>k(e.key),className:`accent-slate-800`}),(0,c.jsx)(`span`,{className:O===e.key?`font-semibold text-slate-900`:`text-slate-600`,children:e.label})]},e.key))})]}),(0,c.jsxs)(`div`,{className:`border-t border-slate-100 pt-3 flex flex-wrap gap-6`,children:[(0,c.jsxs)(`div`,{children:[(0,c.jsx)(`p`,{className:`text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2`,children:`Payment Mode`}),(0,c.jsx)(`div`,{className:`flex gap-4`,children:f.map(e=>(0,c.jsxs)(`label`,{className:`flex items-center gap-1.5 text-sm cursor-pointer`,children:[(0,c.jsx)(`input`,{type:`radio`,name:`payMode`,value:e.key,checked:A===e.key,onChange:()=>re(e.key),className:`accent-slate-800`}),(0,c.jsx)(`span`,{className:A===e.key?`font-semibold text-slate-900`:`text-slate-600`,children:e.label})]},e.key))})]}),(0,c.jsxs)(`div`,{children:[(0,c.jsx)(`p`,{className:`text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2`,children:`Grant Type`}),(0,c.jsx)(`div`,{className:`flex gap-4`,children:[{key:``,label:`All`},{key:`Granted`,label:`Grant`},{key:`NonGranted`,label:`Non-Grant`}].map(e=>(0,c.jsxs)(`label`,{className:`flex items-center gap-1.5 text-sm cursor-pointer`,children:[(0,c.jsx)(`input`,{type:`radio`,name:`grantType`,value:e.key,checked:j===e.key,onChange:()=>ie(e.key),className:`accent-slate-800`}),(0,c.jsx)(`span`,{className:j===e.key?`font-semibold text-slate-900`:`text-slate-600`,children:e.label})]},e.key))})]})]}),(0,c.jsxs)(`div`,{className:`border-t border-slate-100 pt-3`,children:[(0,c.jsx)(`p`,{className:`text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2`,children:`Date Range`}),(0,c.jsx)(`div`,{className:`flex flex-wrap gap-2 mb-3`,children:te.map(e=>(0,c.jsx)(`button`,{onClick:()=>le(e.key),className:`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${oe===e.key?`bg-slate-900 text-white border-slate-900`:`bg-white text-slate-600 border-slate-200 hover:border-slate-400`}`,children:e.label},e.key))}),(0,c.jsxs)(`div`,{className:`flex flex-wrap gap-3 items-end`,children:[(0,c.jsxs)(`div`,{children:[(0,c.jsx)(`label`,{className:`block text-xs text-slate-500 mb-1`,children:`From`}),(0,c.jsx)(`input`,{type:`date`,value:P,onChange:e=>{F(e.target.value),N(`custom`)},className:`border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500`})]}),(0,c.jsxs)(`div`,{children:[(0,c.jsx)(`label`,{className:`block text-xs text-slate-500 mb-1`,children:`To`}),(0,c.jsx)(`input`,{type:`date`,value:I,min:P,onChange:e=>{L(e.target.value),N(`custom`)},className:`border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500`})]}),(0,c.jsxs)(`div`,{children:[(0,c.jsx)(`label`,{className:`block text-xs text-slate-500 mb-1`,children:`Edu. Year`}),(0,c.jsxs)(`select`,{value:M,onChange:e=>ae(e.target.value),className:`border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white`,children:[(0,c.jsx)(`option`,{value:``,children:`All Years`}),m.map(e=>(0,c.jsx)(`option`,{value:e,children:e},e))]})]})]})]}),(0,c.jsxs)(`div`,{className:`flex flex-wrap gap-3 items-end pt-1 border-t border-slate-100`,children:[(0,c.jsxs)(`div`,{children:[(0,c.jsx)(`label`,{className:`block text-xs text-slate-500 mb-1`,children:`Class / Course`}),(0,c.jsxs)(`select`,{value:R,onChange:e=>z(e.target.value),className:`border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white`,children:[(0,c.jsx)(`option`,{value:``,children:`All Classes`}),t.map(e=>(0,c.jsx)(`option`,{value:e.code_no,children:e.degree_course_name},e.code_no))]})]}),(0,c.jsxs)(`div`,{children:[(0,c.jsx)(`label`,{className:`block text-xs text-slate-500 mb-1`,children:`Year`}),(0,c.jsxs)(`select`,{value:B,onChange:e=>V(e.target.value),className:`border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white`,children:[(0,c.jsx)(`option`,{value:``,children:`All Years`}),[1,2,3,4,5].map(e=>(0,c.jsx)(`option`,{value:e,children:l[e]},e))]})]}),(0,c.jsxs)(`div`,{children:[(0,c.jsx)(`label`,{className:`block text-xs text-slate-500 mb-1`,children:`Payment Type`}),(0,c.jsxs)(`select`,{value:H,onChange:e=>se(e.target.value),className:`border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white`,children:[(0,c.jsx)(`option`,{value:`college_fee`,children:`College Fee`}),(0,c.jsx)(`option`,{value:`application_fee`,children:`Application Fee`}),(0,c.jsx)(`option`,{value:`all`,children:`All Types`})]})]})]})]}),E&&(0,c.jsx)(`p`,{className:`rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700`,children:E}),p&&(0,c.jsx)(`div`,{className:`rounded-xl border border-slate-200 bg-white p-4`,children:(0,c.jsx)(a,{rows:5,cols:4})}),!p&&x&&(0,c.jsxs)(c.Fragment,{children:[(0,c.jsxs)(`div`,{className:`grid grid-cols-2 sm:grid-cols-5 gap-3`,children:[(0,c.jsx)(S,{label:`Total Collected`,value:g(q.total_collected),accent:`emerald`,wide:!0}),(0,c.jsx)(S,{label:`Transactions`,value:q.txn_count,accent:`slate`}),(0,c.jsx)(S,{label:`Students`,value:q.student_count,accent:`slate`}),(0,c.jsx)(S,{label:`Cash / Offline`,value:g(q.cash_amount),accent:`amber`}),(0,c.jsx)(S,{label:`Online (PayU)`,value:g(q.online_amount),accent:`blue`})]}),!J&&x.by_day.length>0&&(0,c.jsxs)(C,{title:`Day-wise Breakdown`,children:[(0,c.jsx)(`thead`,{className:`bg-slate-50 text-slate-500`,children:(0,c.jsxs)(`tr`,{children:[(0,c.jsx)(w,{children:`Date`}),(0,c.jsx)(w,{right:!0,children:`Transactions`}),(0,c.jsx)(w,{right:!0,children:`Cash (₹)`}),(0,c.jsx)(w,{right:!0,children:`Online (₹)`}),(0,c.jsx)(w,{right:!0,children:`Total (₹)`})]})}),(0,c.jsx)(`tbody`,{className:`divide-y divide-slate-100`,children:x.by_day.map(e=>(0,c.jsxs)(`tr`,{className:`hover:bg-slate-50`,children:[(0,c.jsx)(T,{children:b(e.date)}),(0,c.jsx)(T,{right:!0,children:e.txn_count}),(0,c.jsx)(T,{right:!0,mono:!0,children:Number(e.cash).toLocaleString(`en-IN`)}),(0,c.jsx)(T,{right:!0,mono:!0,children:Number(e.online).toLocaleString(`en-IN`)}),(0,c.jsx)(T,{right:!0,mono:!0,bold:!0,children:Number(e.total).toLocaleString(`en-IN`)})]},e.date))}),(0,c.jsx)(`tfoot`,{className:`bg-slate-50 border-t-2 border-slate-200 text-sm font-bold`,children:(0,c.jsxs)(`tr`,{children:[(0,c.jsx)(`td`,{className:`px-3 py-2 text-slate-700`,children:`Total`}),(0,c.jsx)(`td`,{className:`px-3 py-2 text-right text-slate-700`,children:q.txn_count}),(0,c.jsx)(`td`,{className:`px-3 py-2 text-right font-mono text-slate-800`,children:Number(q.cash_amount).toLocaleString(`en-IN`)}),(0,c.jsx)(`td`,{className:`px-3 py-2 text-right font-mono text-slate-800`,children:Number(q.online_amount).toLocaleString(`en-IN`)}),(0,c.jsx)(`td`,{className:`px-3 py-2 text-right font-mono text-emerald-700`,children:Number(q.total_collected).toLocaleString(`en-IN`)})]})})]}),x.by_course.length>0&&(0,c.jsxs)(C,{title:`Course-wise Breakdown`,children:[(0,c.jsx)(`thead`,{className:`bg-slate-50 text-slate-500`,children:(0,c.jsxs)(`tr`,{children:[(0,c.jsx)(w,{children:`Course`}),(0,c.jsx)(w,{children:`Year`}),(0,c.jsx)(w,{right:!0,children:`Transactions`}),(0,c.jsx)(w,{right:!0,children:`Total (₹)`})]})}),(0,c.jsx)(`tbody`,{className:`divide-y divide-slate-100`,children:x.by_course.map((e,t)=>(0,c.jsxs)(`tr`,{className:`hover:bg-slate-50`,children:[(0,c.jsx)(T,{children:e.course_name}),(0,c.jsx)(T,{children:u[e.year_of_study]||e.year_of_study}),(0,c.jsx)(T,{right:!0,children:e.txn_count}),(0,c.jsx)(T,{right:!0,mono:!0,bold:!0,children:Number(e.total).toLocaleString(`en-IN`)})]},t))})]}),(0,c.jsxs)(`div`,{className:`rounded-xl border border-slate-200 bg-white overflow-hidden`,children:[(0,c.jsxs)(`button`,{onClick:()=>ce(e=>!e),className:`w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition border-b border-slate-200`,children:[(0,c.jsxs)(`p`,{className:`text-xs font-bold uppercase tracking-wide text-slate-500`,children:[`Transactions`,(0,c.jsxs)(`span`,{className:`ml-2 font-normal text-slate-400`,children:[`(`,x.transactions.length,x.transactions.length===200?`+`:``,`)`]})]}),(0,c.jsx)(`svg`,{className:`w-4 h-4 text-slate-400 transition-transform ${U?`rotate-180`:``}`,fill:`none`,viewBox:`0 0 24 24`,stroke:`currentColor`,strokeWidth:`2`,children:(0,c.jsx)(`path`,{strokeLinecap:`round`,strokeLinejoin:`round`,d:`M19 9l-7 7-7-7`})})]}),U&&(x.transactions.length===0?(0,c.jsx)(`p`,{className:`px-4 py-6 text-sm text-slate-400 text-center`,children:`No transactions in this period.`}):(0,c.jsx)(`div`,{className:`overflow-x-auto`,children:(0,c.jsxs)(`table`,{className:`w-full text-xs`,children:[(0,c.jsx)(`thead`,{className:`bg-slate-50 text-slate-500 border-b border-slate-200`,children:(0,c.jsxs)(`tr`,{children:[(0,c.jsx)(w,{children:`Student`}),(0,c.jsx)(w,{children:`Course / Year`}),(0,c.jsx)(w,{children:`Reg. No.`}),(0,c.jsx)(w,{children:`Type`}),(0,c.jsx)(w,{children:`Mode`}),(0,c.jsx)(w,{children:`Date & Time`}),(0,c.jsx)(w,{right:!0,children:`Amount (₹)`})]})}),(0,c.jsx)(`tbody`,{className:`divide-y divide-slate-100 bg-white`,children:x.transactions.map(e=>{let t=e.gateway===`cash`||e.gateway_txnid?.startsWith(`CASH-`);return(0,c.jsxs)(`tr`,{className:`hover:bg-slate-50`,children:[(0,c.jsx)(T,{children:e.student_name}),(0,c.jsxs)(T,{children:[e.course_name,` · `,u[e.year_of_study],e.app_division?` Div ${e.app_division}`:``]}),(0,c.jsx)(T,{mono:!0,children:e.registration_number||`—`}),(0,c.jsx)(T,{children:(0,c.jsx)(`span`,{className:`rounded-full px-2 py-0.5 font-semibold ${e.payment_type===`college_fee`?`bg-emerald-50 text-emerald-700`:`bg-blue-50 text-blue-700`}`,children:e.payment_type===`college_fee`?`College`:`Application`})}),(0,c.jsx)(T,{children:(0,c.jsx)(`span`,{className:`rounded-full px-2 py-0.5 font-semibold ${t?`bg-amber-50 text-amber-700`:e.via_payment_link?`bg-green-50 text-green-700`:`bg-sky-50 text-sky-700`}`,children:t?`Cash`:e.via_payment_link?`WA Link`:`Online`})}),(0,c.jsxs)(T,{children:[v(e.completed_at),` `,y(e.completed_at)]}),(0,c.jsx)(T,{right:!0,mono:!0,bold:!0,children:Number(e.amount).toLocaleString(`en-IN`)})]},e.id)})})]})}))]}),q.total_collected===0&&q.txn_count===0&&(0,c.jsx)(`div`,{className:`rounded-xl border border-slate-200 bg-slate-50 px-5 py-10 text-center`,children:(0,c.jsx)(`p`,{className:`text-slate-400 text-sm`,children:`No fee collections found for the selected filters.`})})]})]})}function S({label:e,value:t,accent:n,wide:r}){return(0,c.jsxs)(`div`,{className:`rounded-xl border p-4 text-center ${{emerald:`bg-emerald-50 border-emerald-200 text-emerald-700`,amber:`bg-amber-50  border-amber-200  text-amber-700`,blue:`bg-blue-50   border-blue-200   text-blue-700`,slate:`bg-white     border-slate-200  text-slate-800`}[n]} ${r?`col-span-2 sm:col-span-1`:``}`,children:[(0,c.jsx)(`p`,{className:`text-xs text-slate-400 font-medium mb-1`,children:e}),(0,c.jsx)(`p`,{className:`text-xl font-black ${n===`emerald`?`text-emerald-700`:n===`amber`?`text-amber-700`:n===`blue`?`text-blue-700`:`text-slate-950`}`,children:t})]})}function C({title:e,children:t}){return(0,c.jsxs)(`div`,{className:`rounded-xl border border-slate-200 bg-white overflow-hidden`,children:[(0,c.jsx)(`div`,{className:`px-4 py-3 border-b border-slate-100 bg-slate-50`,children:(0,c.jsx)(`p`,{className:`text-xs font-bold uppercase tracking-wide text-slate-500`,children:e})}),(0,c.jsx)(`div`,{className:`overflow-x-auto`,children:(0,c.jsx)(`table`,{className:`w-full text-xs`,children:t})})]})}function w({children:e,right:t}){return(0,c.jsx)(`th`,{className:`px-3 py-2 font-semibold whitespace-nowrap ${t?`text-right`:`text-left`}`,children:e})}function T({children:e,right:t,mono:n,bold:r}){return(0,c.jsx)(`td`,{className:`px-3 py-2 ${t?`text-right`:``} ${n?`font-mono`:``} ${r?`font-bold text-slate-900`:`text-slate-700`}`,children:e})}export{x as default};