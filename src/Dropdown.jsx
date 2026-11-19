import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

// Custom select. options: [{ value, label, dot?, icon? }]
export default function Dropdown({ value, onChange, options, placeholder = 'Select…', label }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const selected = options.find((o) => o.value === value);

  const openMenu = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const pick = (o) => {
    onChange(o.value);
    close();
  };

  // Menu is position: fixed so it is never clipped by a scrolling modal
  useLayoutEffect(() => {
    if (!open) return;
    const r = triggerRef.current.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || 0;
    const up = r.bottom + 6 + menuH > window.innerHeight && r.top - 6 - menuH > 0;
    setPos({
      top: up ? r.top - 6 - menuH : r.bottom + 6,
      left: r.left,
      minWidth: r.width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) close(false);
    };
    const onMove = () => close(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) menuRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKeyDown = (e) => {
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    const moves = { ArrowDown: Math.min(active + 1, last), ArrowUp: Math.max(active - 1, 0), Home: 0, End: last };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(options[active]);
    } else if (e.key === 'Escape') {
      e.stopPropagation(); // don't close the surrounding modal
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={'dropdown-trigger' + (open ? ' open' : '')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className={'dropdown-value' + (selected ? '' : ' placeholder')}>
          {selected && <Mark o={selected} />}
          {selected ? selected.label : placeholder}
        </span>
        <Icon name="chevronDown" size={16} className="dropdown-chevron" />
      </button>
      {open && (
        <ul
          ref={menuRef}
          className="dropdown-menu"
          role="listbox"
          style={pos ? { ...pos } : { visibility: 'hidden', top: 0, left: 0 }}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={(i === active ? 'active' : '') + (o.value === value ? ' selected' : '')}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o)}
            >
              <Mark o={o} />
              <span className="dropdown-label">{o.label}</span>
              {o.value === value && <Icon name="check" size={15} className="dropdown-check" />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Mark({ o }) {
  if (o.icon) return <Icon name={o.icon} size={15} className="dropdown-icon" />;
  if (o.dot) return <span className={'dot ' + o.dot} />;
  return null;
}
