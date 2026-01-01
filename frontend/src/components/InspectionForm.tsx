import { useState, useEffect } from 'react';
import { FiX, FiSave, FiPlus, FiTrash2, FiChevronDown, FiChevronRight, FiUpload, FiFileText, FiExternalLink, FiDownload } from 'react-icons/fi';
import { inspectionApi, checklistApi, tmlApi, inspectionImageApi, inspectionDocumentApi, getInspectionImageUrl, getInspectionDocumentUrl } from '../api/client';
import type { Inspection, InspectionChecklistItem, TmlMeasurement, InspectionImage, InspectionDocument, InspectionOverallStatus } from '../types';
import { INSPECTION_STATUS_COLORS } from '../types';
import { generateInspectionPdf } from '../utils/generateInspectionPdf';

interface InspectionFormProps {
  annotationId: string;
  kksNumber: string;
  material?: string;
  diameter?: string;
  inspectionId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function InspectionForm({
  annotationId,
  kksNumber,
  material,
  diameter,
  inspectionId,
  onClose,
  onSaved,
}: InspectionFormProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [reportNumber, setReportNumber] = useState('');
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextInspectionDate, setNextInspectionDate] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [inspectorCert, setInspectorCert] = useState('');
  const [approverName, setApproverName] = useState('');
  const [approverCert, setApproverCert] = useState('');
  const [overallStatus, setOverallStatus] = useState<InspectionOverallStatus>('pending');
  const [conclusion, setConclusion] = useState('');

  // Related data
  const [checklist, setChecklist] = useState<InspectionChecklistItem[]>([]);
  const [tmlMeasurements, setTmlMeasurements] = useState<TmlMeasurement[]>([]);
  const [images, setImages] = useState<InspectionImage[]>([]);
  const [documents, setDocuments] = useState<InspectionDocument[]>([]);

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    general: true,
    checklist: true,
    tml: false,
    images: false,
    documents: true,
  });

  // New TML form
  const [newTml, setNewTml] = useState({
    tmlNumber: 1,
    objectType: '',
    dimension: '',
    tNom: '',
    tRet: '',
    tAlert: '',
    tMeasured: '',
    position: '',
    comment: '',
  });

  useEffect(() => {
    if (inspectionId) {
      loadInspection();
    }
  }, [inspectionId]);

  const loadInspection = async () => {
    if (!inspectionId) return;

    setLoading(true);
    const { data, error } = await inspectionApi.getOne(inspectionId);

    if (error) {
      setError(error);
    } else if (data) {
      setReportNumber(data.reportNumber || '');
      setInspectionDate(data.inspectionDate);
      setNextInspectionDate(data.nextInspectionDate || '');
      setInspectorName(data.inspectorName);
      setInspectorCert(data.inspectorCert || '');
      setApproverName(data.approverName || '');
      setApproverCert(data.approverCert || '');
      setOverallStatus(data.overallStatus);
      setConclusion(data.conclusion || '');
      setChecklist(data.checklist || []);
      setTmlMeasurements(data.tmlMeasurements || []);
      setImages(data.images || []);
      setDocuments(data.documents || []);

      // Set next TML number
      if (data.tmlMeasurements && data.tmlMeasurements.length > 0) {
        const maxNum = Math.max(...data.tmlMeasurements.map(t => t.tmlNumber));
        setNewTml(prev => ({ ...prev, tmlNumber: maxNum + 1 }));
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!inspectorName || !inspectionDate) {
      setError('Inspektør navn og inspektionsdato er påkrævet');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let savedInspectionId = inspectionId;

      if (inspectionId) {
        // Update existing
        const { error } = await inspectionApi.update(inspectionId, {
          reportNumber,
          inspectionDate,
          nextInspectionDate: nextInspectionDate || null,
          inspectorName,
          inspectorCert: inspectorCert || null,
          approverName: approverName || null,
          approverCert: approverCert || null,
          overallStatus,
          conclusion: conclusion || null,
        });

        if (error) throw new Error(error);
      } else {
        // Create new
        const { data, error } = await inspectionApi.create(annotationId, {
          reportNumber,
          inspectionDate,
          nextInspectionDate: nextInspectionDate || undefined,
          inspectorName,
          inspectorCert: inspectorCert || undefined,
          approverName: approverName || undefined,
          approverCert: approverCert || undefined,
          overallStatus,
          conclusion: conclusion || undefined,
        });

        if (error) throw new Error(error);
        savedInspectionId = data?.id;
        setChecklist(data?.checklist || []);
      }

      // Save checklist changes
      if (savedInspectionId && checklist.length > 0) {
        await checklistApi.bulkUpdate(
          savedInspectionId,
          checklist.map(item => ({
            id: item.id,
            status: item.status,
            comment: item.comment || undefined,
            reference: item.reference || undefined,
          }))
        );
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke gemme inspektion');
    } finally {
      setSaving(false);
    }
  };

  const handleChecklistChange = (itemId: string, field: 'status' | 'comment' | 'reference', value: string) => {
    setChecklist(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleAddTml = async () => {
    if (!inspectionId) {
      setError('Gem inspektionen først for at tilføje TML-målinger');
      return;
    }

    const { data, error } = await tmlApi.create(inspectionId, {
      tmlNumber: newTml.tmlNumber,
      objectType: newTml.objectType || undefined,
      dimension: newTml.dimension || undefined,
      tNom: newTml.tNom ? parseFloat(newTml.tNom) : undefined,
      tRet: newTml.tRet ? parseFloat(newTml.tRet) : undefined,
      tAlert: newTml.tAlert ? parseFloat(newTml.tAlert) : undefined,
      tMeasured: newTml.tMeasured ? parseFloat(newTml.tMeasured) : undefined,
      position: newTml.position || undefined,
      comment: newTml.comment || undefined,
    });

    if (error) {
      setError(error);
    } else if (data) {
      setTmlMeasurements(prev => [...prev, data]);
      setNewTml({
        tmlNumber: newTml.tmlNumber + 1,
        objectType: '',
        dimension: '',
        tNom: '',
        tRet: '',
        tAlert: '',
        tMeasured: '',
        position: '',
        comment: '',
      });
    }
  };

  const handleDeleteTml = async (id: string) => {
    const { error } = await tmlApi.delete(id);
    if (error) {
      setError(error);
    } else {
      setTmlMeasurements(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!inspectionId) {
      setError('Gem inspektionen først for at uploade billeder');
      return;
    }

    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const { data, error } = await inspectionImageApi.upload(inspectionId, file);
      if (error) {
        setError(error);
      } else if (data) {
        setImages(prev => [...prev, data]);
      }
    }

    e.target.value = '';
  };

  const handleDeleteImage = async (id: string) => {
    const { error } = await inspectionImageApi.delete(id);
    if (error) {
      setError(error);
    } else {
      setImages(prev => prev.filter(img => img.id !== id));
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!inspectionId) {
      setError('Gem inspektionen først for at uploade dokumenter');
      return;
    }

    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const { data, error } = await inspectionDocumentApi.upload(inspectionId, file, 'report');
      if (error) {
        setError(error);
      } else if (data) {
        setDocuments(prev => [...prev, data]);
      }
    }

    e.target.value = '';
  };

  const handleDeleteDocument = async (id: string) => {
    const { error } = await inspectionDocumentApi.delete(id);
    if (error) {
      setError(error);
    } else {
      setDocuments(prev => prev.filter(doc => doc.id !== id));
    }
  };

  const handleExportPdf = async () => {
    if (!inspectionId) {
      setError('Gem inspektionen først for at eksportere PDF');
      return;
    }

    setGeneratingPdf(true);
    setError(null);

    try {
      // Build inspection object with current form data
      const inspectionData: Inspection = {
        id: inspectionId,
        annotationId,
        reportNumber: reportNumber || undefined,
        inspectionDate,
        nextInspectionDate: nextInspectionDate || undefined,
        inspectorName,
        inspectorCert: inspectorCert || undefined,
        approverName: approverName || undefined,
        approverCert: approverCert || undefined,
        overallStatus,
        conclusion: conclusion || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checklist,
        tmlMeasurements,
        images,
      };

      await generateInspectionPdf({
        inspection: inspectionData,
        kksNumber,
        material,
        diameter,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke generere PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="inspection-form-overlay">
        <div className="inspection-form">
          <div className="loading-spinner">Indlæser inspektion...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="inspection-form-overlay">
      <div className="inspection-form">
        <div className="form-header">
          <h2>{inspectionId ? 'Rediger inspektion' : 'Ny inspektion'}</h2>
          <div className="header-info">
            <span className="kks-badge">{kksNumber}</span>
            {material && <span className="material-badge">{material}</span>}
            {diameter && <span className="diameter-badge">{diameter}</span>}
          </div>
          <button className="btn-close" onClick={onClose}>
            <FiX />
          </button>
        </div>

        {error && (
          <div className="form-error">
            <span>{error}</span>
            <button onClick={() => setError(null)}><FiX /></button>
          </div>
        )}

        <div className="form-content">
          {/* General Info Section */}
          <div className="form-section">
            <button className="section-toggle" onClick={() => toggleSection('general')}>
              {expandedSections.general ? <FiChevronDown /> : <FiChevronRight />}
              <span>Generel information</span>
            </button>

            {expandedSections.general && (
              <div className="section-content">
                <div className="form-row">
                  <div className="form-group">
                    <label>Rapportnummer</label>
                    <input
                      type="text"
                      value={reportNumber}
                      onChange={(e) => setReportNumber(e.target.value)}
                      placeholder="f.eks. 25378-01-TR-ISP"
                    />
                  </div>
                  <div className="form-group">
                    <label>Samlet status</label>
                    <select
                      value={overallStatus}
                      onChange={(e) => setOverallStatus(e.target.value as InspectionOverallStatus)}
                      style={{ borderColor: INSPECTION_STATUS_COLORS[overallStatus] }}
                    >
                      <option value="pending">Afventer</option>
                      <option value="approved">Godkendt</option>
                      <option value="conditional">Betinget godkendt</option>
                      <option value="rejected">Afvist</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Inspektionsdato *</label>
                    <input
                      type="date"
                      value={inspectionDate}
                      onChange={(e) => setInspectionDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Næste inspektion</label>
                    <input
                      type="date"
                      value={nextInspectionDate}
                      onChange={(e) => setNextInspectionDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Inspektør navn *</label>
                    <input
                      type="text"
                      value={inspectorName}
                      onChange={(e) => setInspectorName(e.target.value)}
                      placeholder="Indtast inspektørens navn"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Inspektør certifikat</label>
                    <input
                      type="text"
                      value={inspectorCert}
                      onChange={(e) => setInspectorCert(e.target.value)}
                      placeholder="f.eks. Level II"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Godkender navn</label>
                    <input
                      type="text"
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      placeholder="Indtast godkenderens navn"
                    />
                  </div>
                  <div className="form-group">
                    <label>Godkender certifikat</label>
                    <input
                      type="text"
                      value={approverCert}
                      onChange={(e) => setApproverCert(e.target.value)}
                      placeholder="f.eks. Level III"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Konklusion</label>
                  <textarea
                    value={conclusion}
                    onChange={(e) => setConclusion(e.target.value)}
                    placeholder="Indtast inspektionens konklusion..."
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Checklist Section */}
          <div className="form-section">
            <button className="section-toggle" onClick={() => toggleSection('checklist')}>
              {expandedSections.checklist ? <FiChevronDown /> : <FiChevronRight />}
              <span>Inspektionscheckliste ({checklist.length} punkter)</span>
            </button>

            {expandedSections.checklist && (
              <div className="section-content">
                <div className="checklist-table">
                  <div className="checklist-header">
                    <span className="col-num">#</span>
                    <span className="col-name">Punkt</span>
                    <span className="col-status">Status</span>
                    <span className="col-comment">Kommentar</span>
                  </div>
                  {checklist.map((item) => (
                    <div key={item.id} className="checklist-row">
                      <span className="col-num">{item.itemNumber}</span>
                      <span className="col-name">{item.itemName}</span>
                      <select
                        className="col-status"
                        value={item.status}
                        onChange={(e) => handleChecklistChange(item.id, 'status', e.target.value)}
                      >
                        <option value="na">N/A</option>
                        <option value="ok">OK</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                      </select>
                      <input
                        className="col-comment"
                        type="text"
                        value={item.comment || ''}
                        onChange={(e) => handleChecklistChange(item.id, 'comment', e.target.value)}
                        placeholder="Kommentar..."
                      />
                    </div>
                  ))}
                </div>
                <div className="checklist-legend">
                  <span><strong>OK</strong> = Ingen afvigelser</span>
                  <span><strong>1</strong> = Mindre afvigelse</span>
                  <span><strong>2</strong> = Moderat afvigelse</span>
                  <span><strong>3</strong> = Alvorlig afvigelse</span>
                  <span><strong>N/A</strong> = Ikke relevant</span>
                </div>
              </div>
            )}
          </div>

          {/* TML Measurements Section */}
          <div className="form-section">
            <button className="section-toggle" onClick={() => toggleSection('tml')}>
              {expandedSections.tml ? <FiChevronDown /> : <FiChevronRight />}
              <span>TML-målinger ({tmlMeasurements.length})</span>
            </button>

            {expandedSections.tml && (
              <div className="section-content">
                {tmlMeasurements.length > 0 && (
                  <div className="tml-table">
                    <div className="tml-header">
                      <span>TML#</span>
                      <span>Type</span>
                      <span>Dim.</span>
                      <span>T.nom</span>
                      <span>T.ret</span>
                      <span>T.alert</span>
                      <span>T.målt</span>
                      <span>Position</span>
                      <span></span>
                    </div>
                    {tmlMeasurements.map((tml) => (
                      <div key={tml.id} className="tml-row">
                        <span>{tml.tmlNumber}</span>
                        <span>{tml.objectType || '-'}</span>
                        <span>{tml.dimension || '-'}</span>
                        <span>{tml.tNom ?? '-'}</span>
                        <span>{tml.tRet ?? '-'}</span>
                        <span>{tml.tAlert ?? '-'}</span>
                        <span className={tml.tMeasured && tml.tAlert && tml.tMeasured < tml.tAlert ? 'warning' : ''}>
                          {tml.tMeasured ?? '-'}
                        </span>
                        <span>{tml.position || '-'}</span>
                        <button className="btn-delete" onClick={() => handleDeleteTml(tml.id)}>
                          <FiTrash2 />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {inspectionId && (
                  <div className="add-tml-form">
                    <h4>Tilføj TML-måling</h4>
                    <div className="tml-form-grid">
                      <div className="form-group">
                        <label>TML#</label>
                        <input
                          type="number"
                          value={newTml.tmlNumber}
                          onChange={(e) => setNewTml(prev => ({ ...prev, tmlNumber: parseInt(e.target.value) || 1 }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Type</label>
                        <input
                          type="text"
                          value={newTml.objectType}
                          onChange={(e) => setNewTml(prev => ({ ...prev, objectType: e.target.value }))}
                          placeholder="f.eks. Rør"
                        />
                      </div>
                      <div className="form-group">
                        <label>Dimension</label>
                        <input
                          type="text"
                          value={newTml.dimension}
                          onChange={(e) => setNewTml(prev => ({ ...prev, dimension: e.target.value }))}
                          placeholder="f.eks. 4&quot;"
                        />
                      </div>
                      <div className="form-group">
                        <label>T.nom (mm)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={newTml.tNom}
                          onChange={(e) => setNewTml(prev => ({ ...prev, tNom: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>T.ret (mm)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={newTml.tRet}
                          onChange={(e) => setNewTml(prev => ({ ...prev, tRet: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>T.alert (mm)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={newTml.tAlert}
                          onChange={(e) => setNewTml(prev => ({ ...prev, tAlert: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>T.målt (mm)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={newTml.tMeasured}
                          onChange={(e) => setNewTml(prev => ({ ...prev, tMeasured: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Position</label>
                        <input
                          type="text"
                          value={newTml.position}
                          onChange={(e) => setNewTml(prev => ({ ...prev, position: e.target.value }))}
                          placeholder="f.eks. 12 o'clock"
                        />
                      </div>
                    </div>
                    <button className="btn-add-tml" onClick={handleAddTml}>
                      <FiPlus /> Tilføj måling
                    </button>
                  </div>
                )}

                {!inspectionId && (
                  <p className="info-message">Gem inspektionen først for at tilføje TML-målinger</p>
                )}
              </div>
            )}
          </div>

          {/* Images Section */}
          <div className="form-section">
            <button className="section-toggle" onClick={() => toggleSection('images')}>
              {expandedSections.images ? <FiChevronDown /> : <FiChevronRight />}
              <span>Billeder ({images.length})</span>
            </button>

            {expandedSections.images && (
              <div className="section-content">
                {images.length > 0 && (
                  <div className="images-grid">
                    {images.map((image) => (
                      <div key={image.id} className="image-card">
                        <img src={getInspectionImageUrl(image.filename)} alt={image.originalName} />
                        <div className="image-info">
                          <span className="image-number">#{image.imageNumber}</span>
                          <span className="image-name">{image.originalName}</span>
                          <button className="btn-delete" onClick={() => handleDeleteImage(image.id)}>
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {inspectionId && (
                  <label className="upload-button">
                    <FiUpload />
                    <span>Upload billeder</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      hidden
                    />
                  </label>
                )}

                {!inspectionId && (
                  <p className="info-message">Gem inspektionen først for at uploade billeder</p>
                )}
              </div>
            )}
          </div>

          {/* Documents Section */}
          <div className="form-section">
            <button className="section-toggle" onClick={() => toggleSection('documents')}>
              {expandedSections.documents ? <FiChevronDown /> : <FiChevronRight />}
              <FiFileText style={{ marginLeft: '0.25rem' }} />
              <span>PDF Rapporter ({documents.length})</span>
            </button>

            {expandedSections.documents && (
              <div className="section-content">
                {documents.length > 0 && (
                  <div className="documents-list">
                    {documents.map((doc) => (
                      <div key={doc.id} className="document-item">
                        <FiFileText className="document-icon" />
                        <div className="document-info">
                          <a
                            href={getInspectionDocumentUrl(doc.filename)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="document-name"
                          >
                            {doc.originalName}
                            <FiExternalLink style={{ marginLeft: '0.25rem', fontSize: '0.75rem' }} />
                          </a>
                          <span className="document-date">
                            {new Date(doc.createdAt).toLocaleDateString('da-DK')}
                          </span>
                        </div>
                        <button className="btn-delete" onClick={() => handleDeleteDocument(doc.id)}>
                          <FiTrash2 />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {inspectionId && (
                  <label className="upload-button">
                    <FiUpload />
                    <span>Upload PDF rapport</span>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      multiple
                      onChange={handleDocumentUpload}
                      hidden
                    />
                  </label>
                )}

                {!inspectionId && (
                  <p className="info-message">Gem inspektionen først for at uploade dokumenter</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-cancel" onClick={onClose}>
            Annuller
          </button>
          {inspectionId && (
            <button
              className="btn-export"
              onClick={handleExportPdf}
              disabled={generatingPdf}
            >
              <FiDownload />
              {generatingPdf ? 'Genererer...' : 'Eksporter PDF'}
            </button>
          )}
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            <FiSave />
            {saving ? 'Gemmer...' : 'Gem inspektion'}
          </button>
        </div>
      </div>
    </div>
  );
}
