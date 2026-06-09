import React, { useState, useEffect, useRef } from 'react';
import { useDispatch } from '../store';
import { genId } from '../utils';
import { useFocusTrap } from '../a11y';

// Split a stored "First Last" name into parts, for editing legacy members that
// predate the structured fields.
function splitName(name = '') {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

// Pop-out card for creating (or editing) a team member. Captures the
// structured fields; `name` is kept as "First Last" so the rest of the app
// (matching, display) keeps working unchanged.
export default function MemberModal({ member, onClose }) {
  const dispatch = useDispatch();
  const isEditing = !!member;

  const seed = splitName(member?.name);
  const [firstName, setFirstName] = useState(member?.firstName ?? seed.firstName);
  const [lastName, setLastName] = useState(member?.lastName ?? seed.lastName);
  const [manager, setManager] = useState(member?.manager ?? '');
  const [department, setDepartment] = useState(member?.department ?? '');

  const modalRef = useRef(null);
  useFocusTrap(modalRef);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
  const canSave = firstName.trim().length > 0;

  function save(e) {
    e.preventDefault();
    if (!canSave) return;
    const fields = {
      name,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      manager: manager.trim(),
      department: department.trim(),
    };
    if (isEditing) {
      dispatch({ type: 'UPDATE_TEAM_MEMBER', payload: { id: member.id, ...fields } });
    } else {
      dispatch({ type: 'ADD_TEAM_MEMBER', payload: { id: genId(), role: '', ...fields } });
    }
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="member-modal-title"
        ref={modalRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <form onSubmit={save}>
          <div className="modal-header">
            <h2 id="member-modal-title">{isEditing ? 'Edit team member' : 'Add team member'}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
          </div>

          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="member-first">First name</label>
                <input id="member-first" className="form-input" autoFocus value={firstName}
                  onChange={e => setFirstName(e.target.value)} placeholder="e.g. Alice" />
              </div>
              <div className="form-group">
                <label htmlFor="member-last">Second name</label>
                <input id="member-last" className="form-input" value={lastName}
                  onChange={e => setLastName(e.target.value)} placeholder="e.g. Murray" />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="member-manager">Manager name</label>
              <input id="member-manager" className="form-input" value={manager}
                onChange={e => setManager(e.target.value)} placeholder="Who they report to" />
            </div>
            <div className="form-group">
              <label htmlFor="member-dept">Department</label>
              <input id="member-dept" className="form-input" value={department}
                onChange={e => setDepartment(e.target.value)} placeholder="e.g. Engineering" />
            </div>
          </div>

          <div className="modal-footer">
            <div className="modal-spacer" />
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!canSave}>
              {isEditing ? 'Save changes' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
