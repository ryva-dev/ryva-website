import type { ReactNode } from "react";

type FilterSidebarProps = {
  selectedDepartments: string[];
  selectedExperience: string[];
  selectedSalary: string[];
  selectedSort: string;
  onClearAll: () => void;
  onDepartmentToggle: (value: string) => void;
  onExperienceToggle: (value: string) => void;
  onSalaryToggle: (value: string) => void;
  onSortChange: (value: string) => void;
};

const DEPARTMENTS = ["Talent Management", "Partnerships", "Strategy"];
const EXPERIENCE_OPTIONS = ["0-2 years", "3-5 years", "6-8 years", "9+ years"];
const SALARY_OPTIONS = ["Under $4,000/mo", "$4,000 - $6,000", "$6,000 - $8,000", "$8,000+"];
const SORTS = [
  { label: "Featured", value: "Relevance" },
  { label: "Salary: low to high", value: "Salary: low to high" },
  { label: "Salary: high to low", value: "Salary: high to low" },
  { label: "Seniority", value: "Experience: most first" }
];

function FilterSection({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="r-filter-section">
      <div className="r-filter-section-head">
        <h3>{title}</h3>
      </div>
      <div className="r-filter-section-body">{children}</div>
    </section>
  );
}

export function FilterSidebar({
  onClearAll,
  onDepartmentToggle,
  onExperienceToggle,
  onSalaryToggle,
  onSortChange,
  selectedDepartments,
  selectedExperience,
  selectedSalary,
  selectedSort
}: FilterSidebarProps) {
  const hasActiveFilters =
    selectedDepartments.length > 0 || selectedExperience.length > 0 || selectedSalary.length > 0 || selectedSort !== "Relevance";

  return (
    <aside className="r-market-sidebar">
      <div className="r-market-sidebar-card">
        <div className="r-market-sidebar-top">
          <div>
            <p className="r-market-sidebar-label">Filters</p>
            <h2>Narrow the roster</h2>
          </div>
          {hasActiveFilters ? (
            <button className="r-filter-clear" onClick={onClearAll} type="button">
              Clear all
            </button>
          ) : null}
        </div>

        <FilterSection title="Department">
          {DEPARTMENTS.map((department) => (
            <label className="r-filter-option" key={department}>
              <input
                checked={selectedDepartments.includes(department)}
                onChange={() => onDepartmentToggle(department)}
                type="checkbox"
              />
              <span>{department}</span>
            </label>
          ))}
        </FilterSection>

        <FilterSection title="Experience">
          {EXPERIENCE_OPTIONS.map((experience) => (
            <label className="r-filter-option" key={experience}>
              <input
                checked={selectedExperience.includes(experience)}
                onChange={() => onExperienceToggle(experience)}
                type="checkbox"
              />
              <span>{experience}</span>
            </label>
          ))}
        </FilterSection>

        <FilterSection title="Monthly salary">
          {SALARY_OPTIONS.map((salary) => (
            <label className="r-filter-option" key={salary}>
              <input checked={selectedSalary.includes(salary)} onChange={() => onSalaryToggle(salary)} type="checkbox" />
              <span>{salary}</span>
            </label>
          ))}
        </FilterSection>

        <FilterSection title="Sort">
          {SORTS.map((sort) => (
            <label className="r-filter-option r-filter-option-radio" key={sort.value}>
              <input checked={selectedSort === sort.value} name="worker-sort" onChange={() => onSortChange(sort.value)} type="radio" />
              <span>{sort.label}</span>
            </label>
          ))}
        </FilterSection>
      </div>
    </aside>
  );
}
