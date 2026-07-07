package vacademy.io.admin_core_service.features.telephony.core;

import java.util.List;
import java.util.Set;

/**
 * Best-effort first-name → gender, used ONLY to personalise AI voice calls when the
 * user record carries no gender (the common case for form leads). Deliberately
 * CONSERVATIVE: returns null unless the first name is a well-known Indian name, so the
 * bot falls back to gender-neutral address ("&lt;name&gt; ji") rather than guessing wrong —
 * a wrong "sir"/"ma'am" is worse than none. Not a general-purpose gender oracle.
 *
 * <p>Sets are built via {@code Set.copyOf(List.of(...))} (List tolerates duplicates,
 * Set.copyOf dedupes) so an accidental duplicate can never throw at class-init and
 * break call setup.
 */
public final class NameGender {

    private NameGender() {}

    private static final Set<String> FEMALE = Set.copyOf(List.of(
            "riya", "priya", "neha", "pooja", "puja", "simran", "kavya", "ishita", "shreya", "tanya",
            "shruti", "suhani", "kavitha", "rupali", "aditi", "anjali", "ananya", "anita", "aarti",
            "arti", "asha", "bhavna", "deepika", "deepa", "divya", "ekta", "gauri", "geeta", "gita",
            "harleen", "isha", "jaya", "jyoti", "kajal", "kiran", "komal", "kritika", "lakshmi", "laxmi",
            "madhuri", "mala", "meena", "meera", "megha", "nidhi", "nikita", "nisha", "pallavi", "payal",
            "preeti", "preity", "rachna", "radha", "rani", "rashmi", "reena", "rekha", "richa", "ritu",
            "roopa", "sakshi", "sana", "sangeeta", "sapna", "sarika", "seema", "shalini", "shilpa",
            "shivani", "smita", "sneha", "sonal", "sonam", "sonia", "sudha", "suman", "sunita", "swati",
            "tara", "trisha", "usha", "vandana", "varsha", "vidya", "vishakha", "yamini", "zoya",
            "fatima", "ayesha", "sara", "zara", "mansi", "muskan", "khushi", "tanvi", "diya", "aisha",
            "alia", "kareena", "kiara", "janhvi", "shweta", "pinky", "guddi", "rani", "poonam", "renu"));

    private static final Set<String> MALE = Set.copyOf(List.of(
            "aarav", "aditya", "ajay", "akash", "akshay", "amit", "amol", "anand", "anil", "ankit",
            "ankur", "anuj", "arjun", "arun", "ashok", "ashutosh", "atul", "bharat", "chetan", "deepak",
            "dev", "dhruv", "gaurav", "gopal", "harsh", "hitesh", "irfan", "jatin", "kabir", "karan",
            "karun", "kunal", "lokesh", "manan", "manish", "manoj", "mohit", "mukesh", "naveen", "neel",
            "nikhil", "nitin", "pankaj", "parth", "pawan", "prakash", "pranav", "prateek", "praveen",
            "rahul", "raj", "rajesh", "rakesh", "raman", "ramesh", "ranveer", "ravi", "rehan", "rohan",
            "rohit", "ratan", "sachin", "sagar", "sahil", "sameer", "sandeep", "sanjay", "satish",
            "saurabh", "shubham", "shubh", "siddharth", "soham", "sohan", "sumit", "sunil", "sunny",
            "suraj", "suresh", "tarun", "tushar", "uday", "varun", "vicky", "vijay", "vikas", "vikram",
            "vinay", "vipin", "vishal", "vivek", "yash", "yogesh", "abhishek", "abhilash", "imran",
            "salman", "aamir", "aryan", "kartik", "krishna", "mani", "gokul", "harish", "naresh"));

    /** {@code "MALE"} / {@code "FEMALE"} for a recognised first name, else {@code null}. */
    public static String of(String fullName) {
        if (fullName == null) return null;
        String s = fullName.trim().toLowerCase();
        if (s.isEmpty()) return null;
        int sp = s.indexOf(' ');
        String first = (sp > 0 ? s.substring(0, sp) : s).replaceAll("[^a-z]", "");
        if (first.isEmpty()) return null;
        if (FEMALE.contains(first)) return "FEMALE";
        if (MALE.contains(first)) return "MALE";
        return null;
    }
}
