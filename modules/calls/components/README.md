# Call Components

## Responsive Call Outcome Grid

### Usage

The `.call-outcome-grid` utility class provides responsive grid behavior for call outcome disposition options:

```tsx
<div className="call-outcome-grid">
  {outcomes.map(outcome => (
    <button key={outcome.id} className="...">
      {/* Outcome content */}
    </button>
  ))}
</div>
```

### Responsive Behavior

| Screen Size | Columns | Breakpoint | Use Case |
|-------------|---------|------------|----------|
| < 400px     | 1       | Very narrow | Sidebar/mobile |
| < 768px     | 1       | Small       | Mobile devices |
| 768px - 1279px | 2    | Medium      | Tablets/small desktop |
| ≥ 1280px    | 3       | Large       | Desktop/wide screens |

### Implementation

- **CallOutcomeModal**: Uses this grid for disposition selection
- **CallSidebar**: Modal opens within 320px sidebar, automatically stacks
- **Custom CSS**: Defined in `app/globals.css` using CSS Grid with media queries

### Benefits

1. **Responsive**: Automatically adapts to container width
2. **Consistent**: Same behavior across all call outcome interfaces  
3. **Accessible**: Maintains proper spacing and touch targets
4. **Sidebar-friendly**: Stacks properly in narrow sidebar (320px)

### CSS Implementation

```css
.call-outcome-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

@media (min-width: 768px) {
  .call-outcome-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .call-outcome-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
``` 