package vacademy.io.media_service.constant;

import java.util.HashMap;
import java.util.Map;

public class LL_AI_Constant {

    public static final Map<String, IncidentType> INCIDENT_TYPES = new HashMap<>();

    static {
        INCIDENT_TYPES.put("GD0003", new IncidentType("APPRAISAL BY CLIENT", "Verbal"));
        INCIDENT_TYPES.put("GD0001", new IncidentType("APPRAISAL BY SUPERVISOR", "Verbal"));
        INCIDENT_TYPES.put("GD0002", new IncidentType("APPRAISAL BY SUPERVISOR", "Written"));
        INCIDENT_TYPES.put("GD0004", new IncidentType("APPRAISAL BY CLIENT", "Written"));
        INCIDENT_TYPES.put("GD0005", new IncidentType("APPRAISAL BY MANAGEMENT", "Written"));
        INCIDENT_TYPES.put("TFT1001", new IncidentType("THEFT", "Livestock"));
        INCIDENT_TYPES.put("TFT1002", new IncidentType("THEFT", "Theft of Wildlife (poaching)"));
        INCIDENT_TYPES.put("BGY1002", new IncidentType("BURGLARY", "Burglary at business"));
        INCIDENT_TYPES.put("CC1002", new IncidentType("CYBER CRIME", "Data Breaches in Farming Communities"));
        INCIDENT_TYPES.put("CC1001", new IncidentType("CYBER CRIME", "Hacking of Agricultural Systems"));
        INCIDENT_TYPES.put("CAA1001", new IncidentType("CRIMES AGAINST ANIMALS", "Cruelty to animals"));
        INCIDENT_TYPES.put("LII1001", new IncidentType("LAND INVASION AND INTRUSION", "Unauthorized Occupation of Farmland"));
        INCIDENT_TYPES.put("LA1001", new IncidentType("LABOUR ACTION", "Peaceful protest (picketing, strike)"));
        INCIDENT_TYPES.put("CIG1005", new IncidentType("CRIMES IN GENERAL", "Liquor act offences"));
        INCIDENT_TYPES.put("TF1002", new IncidentType("EMPLOYEE THEFT AND FRAUD", "Falsifying Documents"));
        INCIDENT_TYPES.put("AT1002", new IncidentType("ABSENTEEISM AND TARDINESS", "Chronic Tardiness"));
        INCIDENT_TYPES.put("TF1003", new IncidentType("EMPLOYEE THEFT AND FRAUD", "Theft of Company Property"));
        INCIDENT_TYPES.put("DH1000", new IncidentType("DISCRIMINATION AND HARASSMENT", "Sexual Harassment"));
        INCIDENT_TYPES.put("SV1001", new IncidentType("SAFETY VIOLATIONS", "Ignoring Safety Procedures"));
        INCIDENT_TYPES.put("SV1002", new IncidentType("SAFETY VIOLATIONS", "Failure to Use Protective Equipment"));
        INCIDENT_TYPES.put("SV1003", new IncidentType("SAFETY VIOLATIONS", "Negligence Leading to Accidents"));
        INCIDENT_TYPES.put("DH1002", new IncidentType("DISCRIMINATION AND HARASSMENT", "Gender Discrimination"));
        INCIDENT_TYPES.put("DH1003", new IncidentType("DISCRIMINATION AND HARASSMENT", "Age Discrimination"));
        INCIDENT_TYPES.put("DH1004", new IncidentType("DISCRIMINATION AND HARASSMENT", "Disability Discrimination"));
        INCIDENT_TYPES.put("BI1002", new IncidentType("BULLYING", "Physical Intimidation"));
        INCIDENT_TYPES.put("DH1001", new IncidentType("DISCRIMINATION AND HARASSMENT", "Racial Discrimination"));
        INCIDENT_TYPES.put("TF1001", new IncidentType("EMPLOYEE THEFT AND FRAUD", "Embezzlement"));
        INCIDENT_TYPES.put("BI1003", new IncidentType("BULLYING", "Cyberbullying"));
        INCIDENT_TYPES.put("ELC1005", new IncidentType("ENVIRONMENTAL CRIMES", "Pollution of Agricultural Areas"));
        INCIDENT_TYPES.put("IE1001", new IncidentType("INDUSTRIAL ESPIONAGE", "Unauthorized Access to Competitors' Information"));
        INCIDENT_TYPES.put("IT1001", new IncidentType("INSIDER TRADING", "Illegally Trading Company Securities Based on Non-Public Information"));
        INCIDENT_TYPES.put("CI1001", new IncidentType("CONFLICT OF INTEREST", "Engaging in Activities that Compromise Objectivity"));
        INCIDENT_TYPES.put("SG1001", new IncidentType("SABOTAGE", "Intentional Damage to Company Property"));
        INCIDENT_TYPES.put("SG1002", new IncidentType("SABOTAGE", "Disruptive Actions Affecting Operations"));
        INCIDENT_TYPES.put("VP1001", new IncidentType("VIOLATION OF COMPANY POLICIES", "Breach of Confidentiality"));
        INCIDENT_TYPES.put("VP1002", new IncidentType("VIOLATION OF COMPANY POLICIES", "Misuse of Company Resources"));
        INCIDENT_TYPES.put("VP1003", new IncidentType("VIOLATION OF COMPANY POLICIES", "Violation of Social Media Policies"));
        INCIDENT_TYPES.put("FC1002", new IncidentType("FALSE CLAIMS", "Submitting False Invoices or Reports"));
        INCIDENT_TYPES.put("CI1002", new IncidentType("CONFLICT OF INTEREST", "Accepting Bribes or Kickbacks"));
        INCIDENT_TYPES.put("WR1001", new IncidentType("WHISTLEBLOWER RETALIATION", "Intimidation, harassment, threaten, assault whistleblowers"));
        INCIDENT_TYPES.put("NR1001", new IncidentType("NON-COMPLIANCE WITH REGULATIONS", "Violating Industry Standards"));
        INCIDENT_TYPES.put("FC1001", new IncidentType("FALSE CLAIMS", "Providing False Information to Clients or Customers"));
        INCIDENT_TYPES.put("SA1002", new IncidentType("SUSPICIOUS ACTIVITY", "Tracks found"));
        INCIDENT_TYPES.put("UP1001", new IncidentType("UNETHICAL NEGOTIATION PRACTICES", "Bribery in Business Deals"));
        INCIDENT_TYPES.put("UP1002", new IncidentType("UNETHICAL NEGOTIATION PRACTICES", "Unfair Business Practices"));
        INCIDENT_TYPES.put("UP1003", new IncidentType("UNETHICAL NEGOTIATION PRACTICES", "Sharing Confidential Information with External Parties"));
        INCIDENT_TYPES.put("MI1001", new IncidentType("MISUSE OF COMPANY INFORMATION", "Exploiting Inside Information for Personal Gain"));
        INCIDENT_TYPES.put("LV1002", new IncidentType("LABOR UNION VIOLATIONS", "Interfering with Union Activities"));
        INCIDENT_TYPES.put("LV1003", new IncidentType("LABOR UNION VIOLATIONS", "Retaliating Against Union Members"));
        INCIDENT_TYPES.put("ID1002", new IncidentType("INSUBORDINATION", "Disregarding Company Policies"));
        INCIDENT_TYPES.put("IE1002", new IncidentType("INDUSTRIAL ESPIONAGE", "Stealing Trade Secrets"));
        INCIDENT_TYPES.put("BI1001", new IncidentType("BULLYING", "Verbal Abuse"));
        INCIDENT_TYPES.put("AT1001", new IncidentType("ABSENTEEISM AND TARDINESS", "Excessive Absenteeism"));
        INCIDENT_TYPES.put("NR1002", new IncidentType("NON-COMPLIANCE WITH REGULATIONS", "Ignoring Government Regulations"));
        INCIDENT_TYPES.put("LV1001", new IncidentType("LABOR UNION VIOLATIONS", "Scouting for Labour unions"));
        INCIDENT_TYPES.put("ID1001", new IncidentType("INSUBORDINATION", "Refusing to Follow Supervisory Instructions"));
        INCIDENT_TYPES.put("TFT1003", new IncidentType("THEFT", "Theft of Agricultural Produce"));
        INCIDENT_TYPES.put("TFT1004", new IncidentType("THEFT", "Theft General"));
        INCIDENT_TYPES.put("TFT1005", new IncidentType("THEFT", "Theft of registered self-propelling vehicles"));
        INCIDENT_TYPES.put("TFT1006", new IncidentType("THEFT", "Theft out or from vehicle"));
        INCIDENT_TYPES.put("TFT1007", new IncidentType("THEFT", "Theft of implements"));
        INCIDENT_TYPES.put("TFT1008", new IncidentType("THEFT", "Theft of tools"));
        INCIDENT_TYPES.put("TFT1009", new IncidentType("THEFT", "Theft of pump equipment"));
        INCIDENT_TYPES.put("TFT1010", new IncidentType("THEFT", "Theft of cables"));
        INCIDENT_TYPES.put("TFT1011", new IncidentType("THEFT", "Theft of solar equipment"));
        INCIDENT_TYPES.put("TFT1012", new IncidentType("THEFT", "Theft of cash"));
        INCIDENT_TYPES.put("RBY1001", new IncidentType("ROBBERY", "Robbery at residence (farm house, guest house, room, other)"));
        INCIDENT_TYPES.put("RBY1002", new IncidentType("ROBBERY", "Robbery at business (factory, production area, office, storage area, other)"));
        INCIDENT_TYPES.put("RBY1003", new IncidentType("ROBBERY", "Robbery of motorvehicle (carjacking)"));
        INCIDENT_TYPES.put("RBY1004", new IncidentType("ROBBERY", "Robbery Other (person robbed outside residence or business)"));
        INCIDENT_TYPES.put("BGY1001", new IncidentType("BURGLARY", "Burglary at residence"));
        INCIDENT_TYPES.put("FD1001", new IncidentType("FRAUD", "Committed by customer, supplier, contractor"));
        INCIDENT_TYPES.put("FD1002", new IncidentType("FRAUD", "Committed by employee"));
        INCIDENT_TYPES.put("CAP1001", new IncidentType("CRIMES AGAINST PERSONS", "Murder"));
        INCIDENT_TYPES.put("CAP1002", new IncidentType("CRIMES AGAINST PERSONS", "Assault"));
        INCIDENT_TYPES.put("CAP1003", new IncidentType("CRIMES AGAINST PERSONS", "Sexual offences"));
        INCIDENT_TYPES.put("CAP1004", new IncidentType("CRIMES AGAINST PERSONS", "Kidnapping (adult person taken against will by force for ransom or extortion)"));
        INCIDENT_TYPES.put("CAP1005", new IncidentType("CRIMES AGAINST PERSONS", "Abduction (minor person / child taken willingly or unwillingly from lawful guardian)"));
        INCIDENT_TYPES.put("ELC1006", new IncidentType("ENVIRONMENTAL CRIMES", "Illegal Mining on Agricultural Land"));
        INCIDENT_TYPES.put("CAP1006", new IncidentType("CRIMES AGAINST PERSONS", "Hostage situation at the workplace (movement of person deliberately restricted against threats and demands)"));
        INCIDENT_TYPES.put("COP1001", new IncidentType("CRIMES AGAINST PROPERTY", "Arson (setting fire to buildings and built structures)"));
        INCIDENT_TYPES.put("COP1002", new IncidentType("CRIMES AGAINST PROPERTY", "Veld Fire (illegally setting veld and bush on fire)"));
        INCIDENT_TYPES.put("COP1003", new IncidentType("CRIMES AGAINST PROPERTY", "Destruction of crops"));
        INCIDENT_TYPES.put("COP1004", new IncidentType("CRIMES AGAINST PROPERTY", "Damaging Fences and Boundaries"));
        INCIDENT_TYPES.put("COP1005", new IncidentType("CRIMES AGAINST PROPERTY", "Damaging Farm Infrastructure"));
        INCIDENT_TYPES.put("CAA1002", new IncidentType("CRIMES AGAINST ANIMALS", "Livestock disease sabotage"));
        INCIDENT_TYPES.put("LII1002", new IncidentType("LAND INVASION AND INTRUSION", "Person illegally trespassing / intruding / enroaching on private property."));
        INCIDENT_TYPES.put("LII1003", new IncidentType("LAND INVASION AND INTRUSION", "Livestock intruding onto private property."));
        INCIDENT_TYPES.put("LII1004", new IncidentType("LAND INVASION AND INTRUSION", "Illegal grazing on agricultural land."));
        INCIDENT_TYPES.put("LII1005", new IncidentType("LAND INVASION AND INTRUSION", "Unauthorized Hunting Activities"));
        INCIDENT_TYPES.put("AAD1001", new IncidentType("ACCIDENTS AND DISASTERS", "Natural disaster"));
        INCIDENT_TYPES.put("AAD1002", new IncidentType("ACCIDENTS AND DISASTERS", "Industrial accident"));
        INCIDENT_TYPES.put("AAD1003", new IncidentType("ACCIDENTS AND DISASTERS", "Transport accident"));
        INCIDENT_TYPES.put("ELC1001", new IncidentType("ENVIRONMENTAL CRIMES", "Unauthorized Access to Water Sources"));
        INCIDENT_TYPES.put("ELC1002", new IncidentType("ENVIRONMENTAL CRIMES", "Unauthorized Access to Electricity Sources"));
        INCIDENT_TYPES.put("ELC1003", new IncidentType("ENVIRONMENTAL CRIMES", "Diverting Water Illegally"));
        INCIDENT_TYPES.put("ELC1004", new IncidentType("ENVIRONMENTAL CRIMES", "Illegal Dumping on Farmland"));
        INCIDENT_TYPES.put("ELC1007", new IncidentType("ENVIRONMENTAL CRIMES", "Environmental Degradation from Mining"));
        INCIDENT_TYPES.put("LA1002", new IncidentType("LABOUR ACTION", "Violent protest (property damage, injury to persons)"));
        INCIDENT_TYPES.put("LA1003", new IncidentType("LABOUR ACTION", "Intimidation (preventing willing employees from working)"));
        INCIDENT_TYPES.put("CIG1001", new IncidentType("CRIMES IN GENERAL", "Disturbing of the peace"));
        INCIDENT_TYPES.put("CIG1002", new IncidentType("CRIMES IN GENERAL", "Illegal Possession of Firearms"));
        INCIDENT_TYPES.put("CIG1003", new IncidentType("CRIMES IN GENERAL", "Firearms Control Act Offences"));
        INCIDENT_TYPES.put("CIG1004", new IncidentType("CRIMES IN GENERAL", "Illegal Possesion of drugs"));
        INCIDENT_TYPES.put("CIG1006", new IncidentType("CRIMES IN GENERAL", "Illegal Trade in Agricultural Produce"));
        INCIDENT_TYPES.put("ET1001", new IncidentType("EXTERNAL THREATS", "Inter-community Disputes Impacting Farming Operations"));
        INCIDENT_TYPES.put("ET1002", new IncidentType("EXTERNAL THREATS", "Tribal or Ethnic Conflicts"));
        INCIDENT_TYPES.put("ET1003", new IncidentType("EXTERNAL THREATS", "Crimes Perpetrated Across International Borders"));
        INCIDENT_TYPES.put("ET1004", new IncidentType("EXTERNAL THREATS", "Transnational Criminal Activities in Farming Regions"));
        INCIDENT_TYPES.put("ET1005", new IncidentType("EXTERNAL THREATS", "Human Trafficking in Farming Communities"));
        INCIDENT_TYPES.put("SA1001", new IncidentType("SUSPICIOUS ACTIVITY", "Shots fired"));
        INCIDENT_TYPES.put("SA1003", new IncidentType("SUSPICIOUS ACTIVITY", "Snares found (no animal trapped)"));
        INCIDENT_TYPES.put("SA1004", new IncidentType("SUSPICIOUS ACTIVITY", "Suspicious persons moving inside or outside of the site"));
        INCIDENT_TYPES.put("SA1005", new IncidentType("SUSPICIOUS ACTIVITY", "Tampering with fences, locks, equipment"));
        INCIDENT_TYPES.put("SA1006", new IncidentType("SUSPICIOUS ACTIVITY", "Other"));

    }

    public static Map<String, IncidentType> getIncidentTypes() {
        return INCIDENT_TYPES; // Or return Collections.unmodifiableMap(INCIDENT_TYPES) for immutability
    }

}
