type FilterSidebarProps = {
  selectedDepartments: string[];
  selectedExperience: string[];
  selectedSalary: string[];
  selectedSort: string;
  onDepartmentToggle: (value: string) => void;
  onExperienceToggle: (value: string) => void;
  onSalaryToggle: (value: string) => void;
  onSortChange: (value: string) => void;
};

const DEPARTMENTS = ["Talent Management", "Partnerships", "Strategy"];
const SORTS = ["Relevance", "Salary: low to high", "Salary: high to low", "Experience: most first"];
const SORT_LABELS: Record<string, string> = {
  Relevance: "Featured",
  "Salary: low to high": "$ ↑",
  "Salary: high to low": "$ ↓",
  "Experience: most first": "Seniority",
};

export function FilterSidebar({
  selectedDepartments,
  selectedSort,
  onDepartmentToggle,
  onSortChange,
}: FilterSidebarProps) {
  return (
    <div className="r-filters">
      <div className="r-fpills">
        {DEPARTMENTS.map((dept) => (
          <button
            key={dept}
            type="button"
            className={`r-fpill${selectedDepartments.includes(dept) ? " on" : ""}`}
            onClick={() => onDepartmentToggle(dept)}
          >
            {dept}
          </button>
        ))}
      </div>
      <div className="r-seg" role="group" aria-label="Sort workers">
        {SORTS.map((sort) => (
          <button
            key={sort}
            type="button"
            className={`r-seg-btn${selectedSort === sort ? " on" : ""}`}
            onClick={() => onSortChange(sort)}
          >
            {SORT_LABELS[sort]}
          </button>
        ))}
      </div>
    </div>
  );
}
