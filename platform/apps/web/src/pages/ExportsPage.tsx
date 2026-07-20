import { useEffect, useState } from "react";
import { api } from "../api";
import { ErrorPanel, Field, Loading, PageHeader } from "../components";
import { useLoad } from "../hooks";

type Capabilities={
  scopes:string[];formats:string[];documentPolicy:string;
};
type ExportResult={
  id:string;status:string;digest:string;
  manifest?:{rowCount:number;generatedAt:string;scopes:string[]};
};

export function ExportsPage(){
  const capabilities=useLoad(()=>api<Capabilities>("/api/data-exports/capabilities"),[]);
  const [selected,setSelected]=useState<string[]>([]);
  const [format,setFormat]=useState<"json"|"csv_bundle">("json");
  const [includeDocuments,setIncludeDocuments]=useState(false);
  const [result,setResult]=useState<ExportResult|null>(null);
  const [error,setError]=useState("");
  const [working,setWorking]=useState(false);
  const resultId=result?.id;
  const resultStatus=result?.status;
  useEffect(()=>{
    if(!resultId||!resultStatus||!["queued","generating"].includes(resultStatus)) return;
    const timer=window.setInterval(()=>{
      void api<ExportResult>(`/api/data-exports/${resultId}`).then(next=>setResult(next))
        .catch(caught=>setError(caught instanceof Error?caught.message:"Export status could not be refreshed."));
    },1500);
    return()=>window.clearInterval(timer);
  },[resultId,resultStatus]);

  async function createExport(){
    setWorking(true);setError("");
    try{
      setResult(await api<ExportResult>("/api/data-exports",{
        method:"POST",body:{scopes:selected,format,includeDocuments}
      }));
    }catch(caught){
      setError(caught instanceof Error?caught.message:"The export could not be generated.");
    }finally{setWorking(false);}
  }

  return <div className="page">
    <PageHeader eyebrow="Data portability" title="Secure exports"
      description="Create a workspace-scoped, audited package with stable identifiers, source and evidence lineage, currency fields, and an integrity digest." />
    {capabilities.loading?<Loading label="Loading export controls" />:null}
    {capabilities.error?<ErrorPanel message={capabilities.error} />:null}
    {error?<ErrorPanel message={error} />:null}
    {capabilities.data?<section className="panel">
      <h2>Select data</h2>
      <div className="check-grid">
        {capabilities.data.scopes.map(scope=><label className="check-row" key={scope}>
          <input type="checkbox" checked={selected.includes(scope)}
            onChange={event=>setSelected(current=>event.target.checked?[...current,scope]:current.filter(item=>item!==scope))} />
          <span>{scope.replaceAll("_"," ")}</span>
        </label>)}
      </div>
      <div className="form-grid">
        <Field label="Package format"><select value={format}
          onChange={event=>setFormat(event.target.value as "json"|"csv_bundle")}>
          <option value="json">Portable JSON</option><option value="csv_bundle">CSV bundle manifest</option>
        </select></Field>
        <label className="check-row"><input type="checkbox" checked={includeDocuments}
          onChange={event=>setIncludeDocuments(event.target.checked)} />
          <span>Request document inclusion review</span>
        </label>
      </div>
      <p className="callout">{capabilities.data.documentPolicy}</p>
      <button className="primary-button" disabled={!selected.length||working}
        onClick={()=>void createExport()}>{working?"Generating…":"Generate audited export"}</button>
    </section>:null}
    {result?<section className="panel success-panel" role="status">
      <h2>{result.status==="ready"?"Export ready":"Export queued"}</h2>
      {result.status==="ready"&&result.manifest?<>
        <p>{result.manifest.rowCount} rows across {result.manifest.scopes.length} scopes. Integrity digest: <code>{result.digest}</code></p>
        <a className="primary-button" href={`/api/data-exports/${result.id}/download`}>Download export</a>
        <p><small>This link expires after 24 hours. Export generation and access are audit recorded.</small></p>
      </>:<p>The durable worker will generate this package. It is safe to leave this page; failures remain retryable in Operations.</p>}
    </section>:null}
  </div>;
}
