import React from 'react';

// 🪪 Wyświetla użytkownika w spójny sposób w całej aplikacji:
//  - jeśli ustawił imię i nazwisko w profilu -> pokazujemy je jako główną,
//    pogrubioną nazwę, a nick z Discorda mniejszą, wyszarzoną czcionką pod spodem,
//  - jeśli nie ustawił -> pokazujemy sam nick, tak jak dotychczas.
export default function PlayerName({ fullName, username, weight = 500, size, color, className, style }) {
  const hasFullName = !!(fullName && fullName.trim());

  if (!hasFullName) {
    return (
      <span
        className={className}
        style={{ fontWeight: weight, fontSize: size, color, ...style }}
      >
        {username}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.25, ...style }}
    >
      <span style={{ fontWeight: weight, fontSize: size, color }}>{fullName}</span>
      <span style={{ fontWeight: 400, fontSize: '0.76em', color: 'var(--text3)' }}>{username}</span>
    </span>
  );
}
