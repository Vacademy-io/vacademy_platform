package vacademy.io.admin_core_service.features.hr_salary.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeProfile;
import vacademy.io.admin_core_service.features.hr_employee.repository.EmployeeProfileRepository;
import vacademy.io.admin_core_service.features.hr_salary.dto.*;
import vacademy.io.admin_core_service.features.hr_salary.entity.*;
import vacademy.io.admin_core_service.features.hr_salary.enums.CalculationType;
import vacademy.io.admin_core_service.features.hr_salary.enums.ComponentType;
import vacademy.io.admin_core_service.features.hr_salary.repository.*;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SalaryStructureService {

    @Autowired
    private EmployeeProfileRepository employeeProfileRepository;

    @Autowired
    private EmployeeSalaryStructureRepository salaryStructureRepository;

    @Autowired
    private EmployeeSalaryComponentRepository salaryComponentRepository;

    @Autowired
    private SalaryTemplateRepository salaryTemplateRepository;

    @Autowired
    private SalaryTemplateComponentRepository salaryTemplateComponentRepository;

    @Autowired
    private SalaryRevisionRepository salaryRevisionRepository;

    /**
     * Assigns a salary structure to an employee based on a template and CTC.
     * Handles component resolution order: Basic first, then percentage-of-basic,
     * then gross-dependent components, then deductions.
     */
    @Transactional
    public String assignSalary(AssignSalaryDTO dto, String instituteId, String approverUserId) {
        // Validate inputs
        if (!StringUtils.hasText(dto.getEmployeeId())) {
            throw new VacademyException("Employee ID is required");
        }
        if (!StringUtils.hasText(dto.getTemplateId())) {
            throw new VacademyException("Template ID is required");
        }
        if (dto.getCtcAnnual() == null || dto.getCtcAnnual().compareTo(BigDecimal.ZERO) <= 0) {
            throw new VacademyException("CTC annual must be a positive value");
        }
        if (dto.getEffectiveFrom() == null) {
            throw new VacademyException("Effective from date is required");
        }

        // 1. Find EmployeeProfile
        EmployeeProfile employee = employeeProfileRepository.findById(dto.getEmployeeId())
                .orElseThrow(() -> new VacademyException("Employee not found with id: " + dto.getEmployeeId()));

        // 2. Find and supersede any active structure
        BigDecimal oldCtc = null;
        EmployeeSalaryStructure oldStructure = null;

        Optional<EmployeeSalaryStructure> activeStructureOpt = salaryStructureRepository
                .findFirstByEmployee_IdAndStatusOrderByEffectiveFromDesc(dto.getEmployeeId(), "ACTIVE");

        if (activeStructureOpt.isPresent()) {
            oldStructure = activeStructureOpt.get();
            oldCtc = oldStructure.getCtcAnnual();
            oldStructure.setStatus("SUPERSEDED");
            oldStructure.setEffectiveTo(dto.getEffectiveFrom().minusDays(1));
            salaryStructureRepository.save(oldStructure);
        }

        // 3. Load template
        SalaryTemplate template = salaryTemplateRepository.findById(dto.getTemplateId())
                .orElseThrow(() -> new VacademyException("Salary template not found with id: " + dto.getTemplateId()));

        // 4. Create new EmployeeSalaryStructure
        BigDecimal ctcMonthly = dto.getCtcAnnual().divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP);

        EmployeeSalaryStructure newStructure = new EmployeeSalaryStructure();
        newStructure.setEmployee(employee);
        newStructure.setTemplate(template);
        newStructure.setEffectiveFrom(dto.getEffectiveFrom());
        newStructure.setCtcAnnual(dto.getCtcAnnual());
        newStructure.setCtcMonthly(ctcMonthly);
        newStructure.setStatus("ACTIVE");
        newStructure.setRevisionReason(dto.getRevisionReason());
        newStructure.setApprovedBy(approverUserId);
        newStructure.setApprovedAt(LocalDateTime.now());

        newStructure = salaryStructureRepository.save(newStructure);

        // 5. Load template components
        List<SalaryTemplateComponent> templateComponents = salaryTemplateComponentRepository
                .findByTemplateIdOrderByDisplayOrderAsc(dto.getTemplateId());

        if (templateComponents.isEmpty()) {
            throw new VacademyException("Template has no components defined");
        }

        // 6. Build override map: componentId -> monthlyAmount
        Map<String, BigDecimal> overrideMap = new HashMap<>();
        if (dto.getComponentOverrides() != null) {
            for (ComponentOverrideDTO override : dto.getComponentOverrides()) {
                if (StringUtils.hasText(override.getComponentId()) && override.getMonthlyAmount() != null) {
                    overrideMap.put(override.getComponentId(), override.getMonthlyAmount());
                }
            }
        }

        // 7. Calculate component amounts in dependency order
        List<EmployeeSalaryComponent> calculatedComponents = calculateComponentAmounts(
                templateComponents, ctcMonthly, overrideMap, newStructure);

        // 8. Save all employee salary components
        salaryComponentRepository.saveAll(calculatedComponents);
        newStructure.setComponents(calculatedComponents);

        // 9. Calculate grossMonthly = sum of EARNING components
        BigDecimal grossMonthly = calculatedComponents.stream()
                .filter(c -> ComponentType.EARNING.name().equals(c.getComponent().getType()))
                .map(EmployeeSalaryComponent::getMonthlyAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 10. Calculate netMonthly = grossMonthly - sum of DEDUCTION components
        BigDecimal totalDeductions = calculatedComponents.stream()
                .filter(c -> ComponentType.DEDUCTION.name().equals(c.getComponent().getType()))
                .map(EmployeeSalaryComponent::getMonthlyAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal netMonthly = grossMonthly.subtract(totalDeductions);

        newStructure.setGrossMonthly(grossMonthly);
        newStructure.setNetMonthly(netMonthly);
        salaryStructureRepository.save(newStructure);

        // 11. Create SalaryRevision record
        SalaryRevision revision = new SalaryRevision();
        revision.setEmployee(employee);
        revision.setOldStructure(oldStructure);
        revision.setNewStructure(newStructure);
        revision.setOldCtc(oldCtc);
        revision.setNewCtc(dto.getCtcAnnual());
        revision.setEffectiveDate(dto.getEffectiveFrom());
        revision.setReason(dto.getRevisionReason());
        revision.setApprovedBy(approverUserId);

        // Calculate increment percentage if there was a previous CTC
        if (oldCtc != null && oldCtc.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal increment = dto.getCtcAnnual().subtract(oldCtc);
            BigDecimal incrementPct = increment
                    .multiply(BigDecimal.valueOf(100))
                    .divide(oldCtc, 2, RoundingMode.HALF_UP);
            revision.setIncrementPct(incrementPct);
        }

        salaryRevisionRepository.save(revision);

        return newStructure.getId();
    }

    /**
     * Calculates salary component amounts respecting dependency order:
     * Phase 1: FIXED_AMOUNT and PERCENTAGE_OF_CTC (these have no dependencies)
     * Phase 2: PERCENTAGE_OF_BASIC (depends on Basic being resolved in Phase 1)
     * Phase 3: PERCENTAGE_OF_GROSS (depends on all EARNING components being resolved)
     *
     * Overrides bypass calculation and use the provided monthly amount directly.
     */
    private List<EmployeeSalaryComponent> calculateComponentAmounts(
            List<SalaryTemplateComponent> templateComponents,
            BigDecimal ctcMonthly,
            Map<String, BigDecimal> overrideMap,
            EmployeeSalaryStructure structure) {

        // Separate components by calculation type for ordered processing
        List<SalaryTemplateComponent> fixedComponents = new ArrayList<>();
        List<SalaryTemplateComponent> pctOfCtcComponents = new ArrayList<>();
        List<SalaryTemplateComponent> pctOfBasicComponents = new ArrayList<>();
        List<SalaryTemplateComponent> pctOfGrossComponents = new ArrayList<>();
        List<SalaryTemplateComponent> formulaComponents = new ArrayList<>();

        for (SalaryTemplateComponent tc : templateComponents) {
            String calcType = tc.getCalculationType();
            if (CalculationType.FIXED_AMOUNT.name().equals(calcType)) {
                fixedComponents.add(tc);
            } else if (CalculationType.PERCENTAGE_OF_CTC.name().equals(calcType)) {
                pctOfCtcComponents.add(tc);
            } else if (CalculationType.PERCENTAGE_OF_BASIC.name().equals(calcType)) {
                pctOfBasicComponents.add(tc);
            } else if (CalculationType.PERCENTAGE_OF_GROSS.name().equals(calcType)) {
                pctOfGrossComponents.add(tc);
            } else if (CalculationType.FORMULA.name().equals(calcType)) {
                formulaComponents.add(tc);
            } else {
                // Default: treat unknown types as fixed
                fixedComponents.add(tc);
            }
        }

        // Result map: componentId -> EmployeeSalaryComponent
        Map<String, EmployeeSalaryComponent> resultMap = new LinkedHashMap<>();

        // PHASE 1: Process FIXED_AMOUNT components
        for (SalaryTemplateComponent tc : fixedComponents) {
            String componentId = tc.getComponent().getId();
            BigDecimal monthlyAmount;
            boolean isOverridden = false;

            if (overrideMap.containsKey(componentId)) {
                monthlyAmount = overrideMap.get(componentId);
                isOverridden = true;
            } else {
                monthlyAmount = tc.getFixedValue() != null ? tc.getFixedValue() : BigDecimal.ZERO;
            }

            resultMap.put(componentId, buildEmployeeSalaryComponent(
                    structure, tc, monthlyAmount, isOverridden));
        }

        // PHASE 2: Process PERCENTAGE_OF_CTC components
        for (SalaryTemplateComponent tc : pctOfCtcComponents) {
            String componentId = tc.getComponent().getId();
            BigDecimal monthlyAmount;
            boolean isOverridden = false;

            if (overrideMap.containsKey(componentId)) {
                monthlyAmount = overrideMap.get(componentId);
                isOverridden = true;
            } else {
                BigDecimal percentage = tc.getPercentageValue() != null ? tc.getPercentageValue() : BigDecimal.ZERO;
                monthlyAmount = ctcMonthly.multiply(percentage)
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                monthlyAmount = clampValue(monthlyAmount, tc.getMinValue(), tc.getMaxValue());
            }

            resultMap.put(componentId, buildEmployeeSalaryComponent(
                    structure, tc, monthlyAmount, isOverridden));
        }

        // PHASE 3: Process PERCENTAGE_OF_BASIC components
        // Find the Basic component: look for code "BASIC" among already-resolved components
        BigDecimal basicMonthly = resolveBasicAmount(resultMap, templateComponents);

        for (SalaryTemplateComponent tc : pctOfBasicComponents) {
            String componentId = tc.getComponent().getId();
            BigDecimal monthlyAmount;
            boolean isOverridden = false;

            if (overrideMap.containsKey(componentId)) {
                monthlyAmount = overrideMap.get(componentId);
                isOverridden = true;
            } else {
                BigDecimal percentage = tc.getPercentageValue() != null ? tc.getPercentageValue() : BigDecimal.ZERO;
                monthlyAmount = basicMonthly.multiply(percentage)
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                monthlyAmount = clampValue(monthlyAmount, tc.getMinValue(), tc.getMaxValue());
            }

            resultMap.put(componentId, buildEmployeeSalaryComponent(
                    structure, tc, monthlyAmount, isOverridden));
        }

        // PHASE 4: Process PERCENTAGE_OF_GROSS components
        // Gross = sum of all EARNING components resolved so far
        BigDecimal earningsTotal = resultMap.values().stream()
                .filter(c -> ComponentType.EARNING.name().equals(c.getComponent().getType()))
                .map(EmployeeSalaryComponent::getMonthlyAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        for (SalaryTemplateComponent tc : pctOfGrossComponents) {
            String componentId = tc.getComponent().getId();
            BigDecimal monthlyAmount;
            boolean isOverridden = false;

            if (overrideMap.containsKey(componentId)) {
                monthlyAmount = overrideMap.get(componentId);
                isOverridden = true;
            } else {
                BigDecimal percentage = tc.getPercentageValue() != null ? tc.getPercentageValue() : BigDecimal.ZERO;
                monthlyAmount = earningsTotal.multiply(percentage)
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                monthlyAmount = clampValue(monthlyAmount, tc.getMinValue(), tc.getMaxValue());
            }

            resultMap.put(componentId, buildEmployeeSalaryComponent(
                    structure, tc, monthlyAmount, isOverridden));
        }

        // PHASE 5: Process FORMULA components (placeholder -- treat as zero unless overridden)
        for (SalaryTemplateComponent tc : formulaComponents) {
            String componentId = tc.getComponent().getId();
            BigDecimal monthlyAmount;
            boolean isOverridden = false;

            if (overrideMap.containsKey(componentId)) {
                monthlyAmount = overrideMap.get(componentId);
                isOverridden = true;
            } else {
                // Formula evaluation is not implemented; default to fixed_value or zero
                monthlyAmount = tc.getFixedValue() != null ? tc.getFixedValue() : BigDecimal.ZERO;
            }

            resultMap.put(componentId, buildEmployeeSalaryComponent(
                    structure, tc, monthlyAmount, isOverridden));
        }

        return new ArrayList<>(resultMap.values());
    }

    /**
     * Resolves the Basic salary amount from already-calculated components.
     * Searches by component code "BASIC" (case-insensitive).
     */
    private BigDecimal resolveBasicAmount(
            Map<String, EmployeeSalaryComponent> resultMap,
            List<SalaryTemplateComponent> templateComponents) {

        // First, try to find Basic in the already-resolved results
        for (Map.Entry<String, EmployeeSalaryComponent> entry : resultMap.entrySet()) {
            SalaryComponent comp = entry.getValue().getComponent();
            if ("BASIC".equalsIgnoreCase(comp.getCode())) {
                return entry.getValue().getMonthlyAmount();
            }
        }

        // If not found, it means Basic hasn't been resolved yet (shouldn't happen if template is set up correctly)
        // Look through template components to see if Basic exists at all
        for (SalaryTemplateComponent tc : templateComponents) {
            if ("BASIC".equalsIgnoreCase(tc.getComponent().getCode())) {
                throw new VacademyException(
                        "Basic component exists in the template but was not resolved before dependent components. " +
                        "Ensure the Basic component uses FIXED_AMOUNT or PERCENTAGE_OF_CTC calculation type.");
            }
        }

        // No Basic component in template at all -- return zero
        return BigDecimal.ZERO;
    }

    /**
     * Clamps a value between min and max bounds (if specified).
     */
    private BigDecimal clampValue(BigDecimal value, BigDecimal minValue, BigDecimal maxValue) {
        if (minValue != null && value.compareTo(minValue) < 0) {
            return minValue;
        }
        if (maxValue != null && value.compareTo(maxValue) > 0) {
            return maxValue;
        }
        return value;
    }

    /**
     * Builds an EmployeeSalaryComponent entity from a template component and calculated monthly amount.
     */
    private EmployeeSalaryComponent buildEmployeeSalaryComponent(
            EmployeeSalaryStructure structure,
            SalaryTemplateComponent tc,
            BigDecimal monthlyAmount,
            boolean isOverridden) {

        EmployeeSalaryComponent esc = new EmployeeSalaryComponent();
        esc.setSalaryStructure(structure);
        esc.setComponent(tc.getComponent());
        esc.setMonthlyAmount(monthlyAmount);
        esc.setAnnualAmount(monthlyAmount.multiply(BigDecimal.valueOf(12)));
        esc.setCalculationType(tc.getCalculationType());
        esc.setPercentageValue(tc.getPercentageValue());
        esc.setIsOverridden(isOverridden);
        return esc;
    }

    /**
     * Gets a salary structure by ID with all its components.
     */
    @Transactional(readOnly = true)
    public EmployeeSalaryStructureDTO getStructure(String structureId) {
        EmployeeSalaryStructure structure = salaryStructureRepository.findById(structureId)
                .orElseThrow(() -> new VacademyException("Salary structure not found"));

        return toStructureDTO(structure);
    }

    /**
     * Gets the full salary history for an employee (all structures, ordered by effectiveFrom desc).
     */
    @Transactional(readOnly = true)
    public List<EmployeeSalaryStructureDTO> getEmployeeSalaryHistory(String employeeId) {
        List<EmployeeSalaryStructure> structures = salaryStructureRepository
                .findByEmployeeIdOrderByEffectiveFromDesc(employeeId);

        return structures.stream()
                .map(this::toStructureDTO)
                .collect(Collectors.toList());
    }

    /**
     * Gets salary revision history for an employee.
     */
    @Transactional(readOnly = true)
    public List<SalaryRevisionDTO> getRevisionHistory(String employeeId) {
        List<SalaryRevision> revisions = salaryRevisionRepository
                .findByEmployeeIdOrderByEffectiveDateDesc(employeeId);

        return revisions.stream()
                .map(this::toRevisionDTO)
                .collect(Collectors.toList());
    }

    private EmployeeSalaryStructureDTO toStructureDTO(EmployeeSalaryStructure structure) {
        EmployeeSalaryStructureDTO dto = EmployeeSalaryStructureDTO.builder()
                .id(structure.getId())
                .employeeId(structure.getEmployee().getId())
                .employeeCode(structure.getEmployee().getEmployeeCode())
                .effectiveFrom(structure.getEffectiveFrom())
                .effectiveTo(structure.getEffectiveTo())
                .ctcAnnual(structure.getCtcAnnual())
                .ctcMonthly(structure.getCtcMonthly())
                .grossMonthly(structure.getGrossMonthly())
                .netMonthly(structure.getNetMonthly())
                .status(structure.getStatus())
                .revisionReason(structure.getRevisionReason())
                .build();

        if (structure.getTemplate() != null) {
            dto.setTemplateId(structure.getTemplate().getId());
            dto.setTemplateName(structure.getTemplate().getName());
        }

        // Load components
        List<EmployeeSalaryComponent> components = salaryComponentRepository
                .findBySalaryStructureId(structure.getId());

        dto.setComponents(components.stream()
                .map(this::toComponentDTO)
                .collect(Collectors.toList()));

        return dto;
    }

    private EmployeeSalaryComponentDTO toComponentDTO(EmployeeSalaryComponent esc) {
        SalaryComponent comp = esc.getComponent();
        return EmployeeSalaryComponentDTO.builder()
                .id(esc.getId())
                .componentId(comp.getId())
                .componentName(comp.getName())
                .componentCode(comp.getCode())
                .componentType(comp.getType())
                .monthlyAmount(esc.getMonthlyAmount())
                .annualAmount(esc.getAnnualAmount())
                .calculationType(esc.getCalculationType())
                .percentageValue(esc.getPercentageValue())
                .isOverridden(esc.getIsOverridden())
                .build();
    }

    private SalaryRevisionDTO toRevisionDTO(SalaryRevision revision) {
        return SalaryRevisionDTO.builder()
                .id(revision.getId())
                .employeeId(revision.getEmployee().getId())
                .employeeCode(revision.getEmployee().getEmployeeCode())
                .oldCtc(revision.getOldCtc())
                .newCtc(revision.getNewCtc())
                .incrementPct(revision.getIncrementPct())
                .reason(revision.getReason())
                .effectiveDate(revision.getEffectiveDate())
                .oldStructureId(revision.getOldStructure() != null ? revision.getOldStructure().getId() : null)
                .newStructureId(revision.getNewStructure().getId())
                .build();
    }
}
