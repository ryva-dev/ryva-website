import { useState } from "react";

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

const filterGroups = [
  {
    title: "Departments",
    items: [
      "Creator Economy",
      "Engineering",
      "Marketing",
      "Sales",
      "Customer Support",
      "Finance",
      "Design",
      "Operations",
      "Data",
      "Human Resources",
      "Content",
      "Legal"
    ]
  },
  {
    title: "Experience",
    items: ["0-2 years", "3-5 years", "6-8 years", "9+ years"]
  },
  {
    title: "Salary",
    items: ["Under $4,000/mo", "$4,000 - $6,000", "$6,000 - $8,000", "$8,000+"]
  },
  {
    title: "Sort",
    items: ["Relevance", "Salary: low to high", "Salary: high to low", "Experience: most first"]
  }
];

export function FilterSidebar({
  selectedDepartments,
  selectedExperience,
  selectedSalary,
  selectedSort,
  onDepartmentToggle,
  onExperienceToggle,
  onSalaryToggle,
  onSortChange
}: FilterSidebarProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Departments: true,
    Experience: true,
    Salary: true,
    Sort: true
  });

  return (
    <aside className="filter-sidebar">
      <div className="filter-sidebar-head">
        <h2>Filters</h2>
      </div>
      {filterGroups.map((group) => (
        <section className="filter-group" key={group.title}>
          <button
            className="filter-group-head"
            onClick={() =>
              setOpenGroups((current) => ({
                ...current,
                [group.title]: !current[group.title]
              }))
            }
            type="button"
          >
            <h3>{group.title}</h3>
            <span className={`filter-caret ${openGroups[group.title] ? "filter-caret-open" : ""}`}>
              ⌄
            </span>
          </button>
          {openGroups[group.title] && (
            <ul>
              {group.items.map((item) => (
                <li key={item}>
                  <label className={`filter-option ${group.title === "Sort" ? "filter-option-radio" : ""}`}>
                    <input
                      type={group.title === "Sort" ? "radio" : "checkbox"}
                      name={group.title === "Sort" ? "sort" : item}
                      checked={
                        group.title === "Departments"
                          ? selectedDepartments.includes(item)
                          : group.title === "Experience"
                            ? selectedExperience.includes(item)
                            : group.title === "Salary"
                              ? selectedSalary.includes(item)
                              : group.title === "Sort"
                                ? selectedSort === item
                                : false
                      }
                      onChange={() => {
                        if (group.title === "Departments") {
                          onDepartmentToggle(item);
                          return;
                        }
                        if (group.title === "Experience") {
                          onExperienceToggle(item);
                          return;
                        }
                        if (group.title === "Salary") {
                          onSalaryToggle(item);
                          return;
                        }
                        if (group.title === "Sort") {
                          onSortChange(item);
                        }
                      }}
                    />
                    <span>{item}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </aside>
  );
}
